-- 高频词汇打卡 · 每日打卡计数表（让"本周趋势"云端持久、跨设备一致）
-- 在 Supabase 控制台 → SQL Editor 中粘贴执行一次即可。

create table if not exists daily_counter (
  day   text    primary key,   -- 本地日期，格式 YYYY-M-D，如 2026-7-24
  n     integer not null default 0  -- 当天打卡总次数
);

-- 开启行级安全，并允许 anon（公开密钥）对本表做增删改查。
-- 说明：此表仅存放每日打卡次数，不含任何敏感信息；
-- anon key 本就公开，配合该策略即可实现免登录的多设备同步。
alter table daily_counter enable row level security;

drop policy if exists "anon_all" on daily_counter;
create policy "anon_all"
  on daily_counter
  for all
  to anon
  using (true)
  with check (true);
