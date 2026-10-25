/** identity 域 zod 契约（REQ-004 FR-B1.2） */
import { z } from "zod";

// 邮箱长度上限 254（RFC 5321 前向/域名合计上限）：无上限的超长串直插 email_codes.email
// 并参与 hashtext advisory lock，是未认证滥用面（二十轮）。格式校验仍在 service isValidEmail。
const emailField = z.string().max(254).optional();

export const loginSchema = z
  .object({
    email: emailField,
    // 上限 128（对齐 updateProfile）：多 MB 密码串直进 scryptSync 是未认证 CPU/内存放大面
    password: z.string().max(128).optional(),
    emailCode: z.string().optional(),
  })
  .refine((v) => Boolean(v.email), { message: "邮箱必填" });

export const registerSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(128).optional(),
  emailCode: z.string().optional(),
  nickname: z.string().optional(),
});

export const profileSchema = z
  .object({
    nickname: z.string().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
  })
  .refine((v) => v.nickname !== undefined || v.newPassword !== undefined, {
    message: "没有可更新的字段",
  });

export const setupSchema = z.object({
  nickname: z.string().optional(),
  email: emailField,
  password: z.string().optional(),
  setupToken: z.string().optional(),
});
