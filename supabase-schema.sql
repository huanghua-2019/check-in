-- 高频词汇打卡 · Supabase 建表脚本
-- 在 Supabase 控制台 → SQL Editor 中粘贴执行一次即可。

create table if not exists checkin (
  id          integer     primary key,
  count       integer     not null default 0,
  first_used  timestamptz,
  last_used   timestamptz,
  mastery     text        not null default '未用'
);

-- 开启行级安全，并允许 anon（公开密钥）对本表做增删改查。
-- 说明：此表仅存放词汇打卡计数，不含任何敏感信息；
-- anon key 本就公开，配合该策略即可实现免登录的多设备同步。
alter table checkin enable row level security;

drop policy if exists "anon_all" on checkin;
create policy "anon_all"
  on checkin
  for all
  to anon
  using (true)
  with check (true);
