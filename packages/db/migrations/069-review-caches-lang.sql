-- 069 · review_caches 语言维度（中英双语改造）：同一周期中英两份缓存互不覆盖。
-- 存量行回填 'zh'（此前全部为中文生成）；unique 收窄为四元组。
alter table public.review_caches
  add column if not exists lang text not null default 'zh' check (lang in ('zh','en'));
alter table public.review_caches
  drop constraint if exists review_caches_user_id_kind_period_key_key;
alter table public.review_caches
  add constraint review_caches_user_kind_period_lang_key unique (user_id, kind, period_key, lang);
