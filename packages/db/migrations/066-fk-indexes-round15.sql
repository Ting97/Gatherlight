-- 066: 补齐无索引外键（十五轮检视，065 同口径续作——按 pg_constraint/pg_index 全库实测，非推测）
-- 背景：PG 外键不自动建索引。①用户可触达删除路径：删会话（fitness_daily_plans.origin_conversation_id
-- set null）会对子表全表扫；②user_id 列（profiles 级联，管理端触达）：这些列同时也是几乎所有查询的
-- 首个过滤谓词，建索引对日常查询同样受益。
create index if not exists idx_fitness_daily_plans_origin_conversation on public.fitness_daily_plans (origin_conversation_id);
create index if not exists idx_diet_records_user on public.diet_records (user_id);
create index if not exists idx_entry_images_user on public.entry_images (user_id);
create index if not exists idx_entry_recognitions_user on public.entry_recognitions (user_id);
create index if not exists idx_space_milestones_user on public.space_milestones (user_id);
create index if not exists idx_space_reflections_user on public.space_reflections (user_id);
