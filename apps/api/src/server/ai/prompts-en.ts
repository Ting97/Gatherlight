/**
 * 英文默认模板聚合（双语提示词 070）：四个分域翻译文件合成 DEFAULT_PROMPTS_EN。
 * 规则：未覆盖 EN 行时 getPromptBundle 走这里；某 key 缺 EN 模板自动回落 ZH 默认
 * （defaultPrompt 内兜底）——保证翻译未跟上的 key 不会拿到空 prompt。
 * 各分文件硬约束：{占位符}、JSON 契约字段名、中文枚举值与中文目录名保持原样。
 */
import { promptsEnExtract } from "./prompts-en.extract";
import { promptsEnChat } from "./prompts-en.chat";
import { promptsEnReview } from "./prompts-en.review";
import { promptsEnMisc } from "./prompts-en.misc";
import type { PromptKey } from "./prompts";

export const DEFAULT_PROMPTS_EN: Partial<Record<PromptKey, string>> = {
  ...promptsEnExtract,
  ...promptsEnChat,
  ...promptsEnReview,
  ...promptsEnMisc,
};
