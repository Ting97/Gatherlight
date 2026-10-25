[English](./README.md) | **中文**

# xujianshiguang（叙笺拾光）

> **Your life, your data, your AI** — a self-hosted life assistant powered by NVIDIA Nemotron on Nebius Token Factory.

**在线演示：<https://xujianshiguang.ting97.cn>**（默认英文界面，可随时切换中文）

| 账号 | 凭据 | 用途 |
|---|---|---|
| 演示用户 | `en-demo@ting97.cn` / `en-demo-2026` | 已灌入六域英文演示数据，从这里开始体验 |
| 管理员 | `admin@ting97.cn` / `admin1234` | 管理后台：提示词热更、AI 审计、配额、模块开关 |

同时开放注册——任意邮箱即可注册，无需邀请码。

拾光是一个**自托管的个人经营系统**：把日常随口一句话交给 AI，自动识别其中的日程、待办、收支、心情、饮食并记入对应模块；分域 AI 助手基于你自己的结构化数据问答、查询与提案。所有数据留在你自己的服务器和数据库里。

本仓库是 [Nebius x NVIDIA Global AI Hackathon 2026](https://nebiusglobalaihackathon.devpost.com/) 的参赛项目（Personal AI 赛道）。

## Nebius 与 NVIDIA 接入

- 运行时所有 LLM 调用走 **Nebius Token Factory**（`https://api.tokenfactory.nebius.com/v1`，OpenAI 兼容端点）
- 模型：**`nvidia/Nemotron-3_5-Lightning`**（NVIDIA 开源模型，30B MoE——Token Factory 上性价比最高的 Nemotron）——用于分域助手、动态识别、周期复盘与目标拆解
- 工具调用走标准 OpenAI tools 协议：20 个只读查询工具（`query_transactions`、`query_calendar`、`query_contacts`…）+ 需确认的提案工具
- 模型层与端点解耦：`ZHIPUAI_BASE_URL` 指向任意 OpenAI 兼容服务（如智谱 GLM）即可，零代码改动
- Nemotron-3 是思考模型；对延迟敏感的任务通过 `reasoning_effort: "none"` 关闭思考，并兜底兼容其 `reasoning` 字段（`packages/ai/src/glm.ts`）

```env
ZHIPUAI_BASE_URL=https://api.tokenfactory.nebius.com/v1
ZHIPUAI_API_KEY=<你的 Nebius Token Factory key>
GLM_MODEL=nvidia/Nemotron-3_5-Lightning
```

## 核心功能

- **一句话五域识别**：动态流里随口记录（文字/语音），AI 自动识别 → 🕒 日程时间块、📋 待办、💰 收支流水、😊 心情、🍽 饮食；低置信度进入「待确认」，人工确认才入账
- **时间与待办**：日/周/月/年四种日历视图、冲突检测、今日行动清单、子任务拆解与每日重复
- **目标空间**：为大目标（考研上岸、副业过万…）建专属空间，聚合行动、感悟与动态，进度卡片
- **人际图谱**：以你为中心的关系轨道图（可拖动摆位），联系人档案（阳历/农历生日、纪念日、人情往来账）
- **收支与预算**：多账户、分类统计、月度预算与预警、支付宝/微信支付 CSV 账单导入、AI 收支周报
- **健身与睡眠**：训练计划与记录、每日睡眠与感受得分，支持对接训记（SynFit）Open API 同步
- **分域 AI 助手**：全局/目标/日程/人际/财务/健身六个域助手，20 个只读查询工具 + 提案确认卡（AI 不直接写业务数据，提案经你确认生效）
- **模块开关**：子模块可按用户粒度开启/关闭；管理员后台支持提示词热更、AI 审计与配额
- **数据自主**：自建账号体系（邮箱 + 密码，开放注册）、数据导出（JSON / Markdown）、全端登出

## 技术栈

- **前端**：Next.js 15（App Router，静态导出）
- **服务端**：Next.js standalone 托管 API 与静态资源（`src/server/<domain>` 九域拆分）
- **AI 内核**：独立纯包 `packages/ai`——zod 契约 + OpenAI 兼容模型接入 + 规则引擎兜底；工具调用走标准 OpenAI tools 协议
- **数据库**：PostgreSQL（手写 SQL 迁移 + runner，`packages/db`）
- **工程**：npm workspaces monorepo、TypeScript strict、node:test、GitHub Actions CI

## 快速开始

环境要求：Node ≥ 20、PostgreSQL 13+。

```bash
npm install                       # 安装依赖
cp .env.example .env              # 配置环境变量（见下方说明）
npm run db:migrate -- --fresh     # 新库建表（⚠️ 会清空目标库）
npm run dev                       # 本地开发（web）
npm run dev:api                   # 本地开发（api）
```

生产构建与运行：

```bash
npm run build
set -a && source .env && set +a && PORT=3100 node apps/api/.next/standalone/apps/api/server.js
```

关键环境变量（完整见 `.env.example`）：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（必填） |
| `ZHIPUAI_API_KEY` | OpenAI 兼容模型服务的 API key（AI 功能必需） |
| `SETUP_TOKEN` | 初始化一次性令牌：首个管理员经 `POST /api/auth/setup`（`x-setup-token` 请求头携带）创建后失效 |
| `EMAIL_SMTP_*` | 邮箱验证码 SMTP 通道（未配置时注册免验证码直接创建） |
| `AUTH_DISABLED` | 仅本地开发可用；生产非空会拒绝启动 |

**初始化管理员**：服务启动后，用 `SETUP_TOKEN` 调用

```bash
curl -X POST http://127.0.0.1:3100/api/auth/setup \
  -H "content-type: application/json" -H "x-setup-token: <你的 SETUP_TOKEN>" \
  -d '{"nickname":"admin","email":"admin@example.com","password":"your-password"}'
```

之后即可用邮箱在 `/login` 注册使用——注册开放，无需邀请码（系统会为每位注册用户自动生成一条邀请码记录便于追溯）。

**演示数据**：`scripts/qa/seed-*.mjs` 系列脚本可对任意环境灌入各模块演示数据：

```bash
BASE_URL=https://your-host SEED_EMAIL=you@example.com SEED_PASSWORD=xxx node scripts/qa/seed-demo-en.mjs
```

## 目录结构

```
apps/
  web/        # 前端（Next.js 静态导出）
  api/        # 服务端（API + 静态托管，src/server 九域）
packages/
  ai/         # AI 内核纯包（契约/提示词/模型接入/规则兜底）
  shared/     # 跨端类型与纯函数（日期/农历/CSV/图谱/API 客户端）
  db/         # schema.sql + SQL 迁移 + runner
  design-tokens/ # 设计令牌源与生成器
scripts/qa/   # 演示数据种子脚本
```

## 参赛时间线

| 节点 | 时间 |
|---|---|
| 提交截止 | 2026-10-30 10:00 AM PT（北京时间 10-31 01:00） |
| 评审期 | 2026-12-01 ～ 12-15（demo 须存活） |
| 公布 | 约 2027-01-11 |

## 许可证

[Apache-2.0](./LICENSE)
