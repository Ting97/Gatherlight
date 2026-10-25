/**
 * 英文字典聚合：各域文件在此 spread，缺失 key 回退中文原文（见 i18n/index.tsx t()）。
 * key 一律为界面中文原文（含模板插值拆开后的完整短语），新增域文件在此追加一行。
 */
import * as common from "./common";
import * as errors from "./errors";
import * as login from "./login";
import * as profile from "./profile";

export const EN: Record<string, string> = {
  ...common.EN,
  ...errors.EN,
  ...login.EN,
  ...profile.EN,
};
