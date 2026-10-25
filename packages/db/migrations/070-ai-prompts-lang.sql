-- 070: 提示词双语（管理后台 EN/ZH 独立模板与覆盖）
-- ai_prompts 主键 key → (key, lang)：每种语言一行覆盖；存量行归 zh（原语义不变）
-- ai_prompt_versions 加 lang：版本历史按语言隔离，回滚不串语言
alter table public.ai_prompts add column if not exists lang text not null default 'zh';
alter table public.ai_prompts drop constraint if exists ai_prompts_pkey;
alter table public.ai_prompts add primary key (key, lang);

alter table public.ai_prompt_versions add column if not exists lang text not null default 'zh';
