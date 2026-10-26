-- 072: 交往画像双语缓存——ai_profile（存量列）归 zh，新增 _en 列；GET/详情按 X-Lang 取对应语言
alter table public.contacts add column if not exists ai_profile_en jsonb;
alter table public.contacts add column if not exists ai_profile_at_en timestamptz;
