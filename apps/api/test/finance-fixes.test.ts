/**
 * finance/goal 域修复回归（P1 dueAt 校验 / P2 counts 先 restore）：
 * 进程内直调 service（不依赖 Next 请求作用域），真实 SQL 落测试库；
 * 测试用户 22230000- 前缀避免与其它 agent/冒烟撞车，库不可达整组 skip。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const U_GOAL = "22230000-0000-4000-8000-000000000003";
const U_COUNTS = "22230000-0000-4000-8000-000000000005";
const FX_USERS = [U_GOAL, U_COUNTS];

let pool: any;
let loaded = false;
let dbReady = false;

async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  // 安全护栏：未显式指定测试库时不动真实数据库（整组 skip）
  if (!process.env.SHIGUANGRI_TEST_DB) return;
  process.env.DATABASE_URL = process.env.SHIGUANGRI_TEST_DB;
  delete process.env.ZHIPUAI_API_KEY; // 强制零网络（review 生成链路走 402/503 分支）
  delete process.env.TYPESAFE_API_KEY;
  ({ pool } = await import("../src/server/platform/db"));
  try {
    const { rows } = await pool.query("select to_regclass('public.profiles') as t");
    dbReady = rows[0].t !== null;
  } catch {
    dbReady = false;
  }
}

async function upsertUser(id: string, nickname: string) {
  await pool.query(
    `insert into profiles (id, nickname, role) values ($1,$2,'user')
     on conflict (id) do update set role = 'user'`,
    [id, nickname],
  );
}

/* ---------- Fix 3：createTodo/updateTodo 时间入参语义校验 ---------- */

test("goal-fix：dueAt/startAt 非法串 400（不再 Invalid Date 抛 RangeError / 穿透 ::timestamptz 500）", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await upsertUser(U_GOAL, "fx待办");
  const { todoService } = await import("../src/server/goal/service");

  await assert.rejects(
    () => todoService.create(U_GOAL, { title: "fx坏时间", dueAt: "abc" }),
    (e: any) => e?.status === 400 && /dueAt/.test(e.message),
    "create dueAt 非法应 400",
  );
  const { todo } = await todoService.create(U_GOAL, { title: "fx好时间" });
  assert.ok(todo.id, "合法创建不受影响");

  await assert.rejects(
    () => todoService.update(U_GOAL, todo.id, { dueAt: "2025-13-01T09:00" }),
    (e: any) => e?.status === 400 && /dueAt/.test(e.message),
    "PATCH dueAt 形状合法但非真实日期应 400（修复前 PG 500）",
  );
  await assert.rejects(
    () => todoService.update(U_GOAL, todo.id, { startAt: "abc" }),
    (e: any) => e?.status === 400 && /startAt/.test(e.message),
    "PATCH startAt 非法应 400",
  );

  const { todo: patched } = await todoService.update(U_GOAL, todo.id, { dueAt: "2026-10-01T09:00:00+08:00" });
  assert.ok(patched.due_at, "合法 dueAt 更新成功");
  const { todo: cleared } = await todoService.update(U_GOAL, todo.id, { dueAt: null });
  assert.equal(cleared.due_at, null, "dueAt=null 清除时间恒合法");

  await todoService.remove(U_GOAL, todo.id);
});

/* ---------- Fix 5：listTodos 先 restore 再 counts ---------- */

test("goal-fix：日切后首次读取 counts.done 与列表一致（restore 先于 counts）", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await upsertUser(U_COUNTS, "fx计数");
  await pool.query(`delete from todos where user_id = $1`, [U_COUNTS]);
  const { todoService } = await import("../src/server/goal/service");

  const { todo: parent } = await todoService.create(U_COUNTS, { title: "fx父任务" });
  const { todo: action } = await todoService.create(U_COUNTS, {
    title: "fx重复行动",
    parentId: parent.id,
    repeatDaily: true,
  });
  await todoService.update(U_COUNTS, action.id, { done: true });

  const before = await todoService.list(U_COUNTS, "all");
  assert.equal(before.counts.done, 1, "当天完成：done=1（记录日内不恢复）");

  // 模拟跨日：last_done_date 回拨 → 06:00 日切恢复应在本请求内发生
  await pool.query(`update todos set last_done_date = '2020-01-01' where id = $1`, [action.id]);
  const after = await todoService.list(U_COUNTS, "all");
  assert.equal(after.counts.done, 0, "恢复后 counts.done=0（修复前先计数恒 1，与列表矛盾）");
  assert.equal(after.counts.all, 1, "父任务回到待办计数");
  const { rows } = await pool.query(`select status from todos where id = $1`, [action.id]);
  assert.equal(rows[0].status, "pending", "重复行动已惰性恢复为未完成");

  const actions = await todoService.list(U_COUNTS, "today-actions");
  assert.equal(actions.counts.done, 0, "today-actions 视图同样先恢复再计数");

  await pool.query(`delete from todos where user_id = $1`, [U_COUNTS]);
});

/* ---------- teardown ---------- */

test("teardown: 清理 fx 修复测试数据", async (t) => {
  await ensureLoaded();
  if (!dbReady) return t.skip("测试库不可达");
  await pool.query(`delete from todos where user_id = any($1)`, [FX_USERS]);
  await pool.query(`delete from review_caches where user_id = any($1)`, [FX_USERS]);
  await pool.query(`delete from audit_logs where user_id = any($1)`, [FX_USERS]);
  assert.ok(true);
});
