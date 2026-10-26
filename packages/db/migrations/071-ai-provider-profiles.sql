-- 071: 管理后台模型接入（BYOK）：多服务商档案 + 激活切换
-- 运行时切换原理：packages/ai 在调用时读 process.env（ZHIPUAI_*/GLM_*），
-- apps/api 激活档案时改写 env（快照原始值支持切回）；无激活档案 = 环境变量兜底。
create table if not exists public.ai_provider_profiles (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  base_url     text not null,
  api_key      text not null,
  model        text not null,
  vision_model text,
  is_active    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_ai_provider_active on public.ai_provider_profiles (is_active) where is_active;
