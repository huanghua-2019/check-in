-- 通用打卡：习惯定义 + 打卡记录 两张表
-- 在 Supabase SQL Editor 执行一次即可（幂等安全：create table if not exists + 已含 RLS 匿名读写策略）
-- 与 checkin / daily_counter 表并列，共用同一 Supabase 项目。

create table if not exists habits (
  id      serial primary key,
  key     text unique,          -- 业务稳定 ID：sleep / buffett / xu
  name    text not null,
  icon    text,
  color   text,
  type    text default 'toggle',
  fields  jsonb,                -- 自定义字段数组（见设计文档）
  target  text,                 -- timed 类型达标阈值，如 "23:00"
  sort    int default 0,
  created_at timestamptz default now()
);

create table if not exists checkins (
  id        serial primary key,
  habit_id  int references habits(id) on delete cascade,
  ts        timestamptz default now(),   -- 打卡时间（timed 可手动改）
  value     jsonb,                        -- 按 fields 的答案集合
  created_at timestamptz default now()
);

alter table habits enable row level security;
alter table checkins enable row level security;

drop policy if exists "anon_all" on habits;
create policy "anon_all"
  on habits for all
  to anon
  using (true) with check (true);

drop policy if exists "anon_all" on checkins;
create policy "anon_all"
  on checkins for all
  to anon
  using (true) with check (true);
