-- 可选：让「我的例句」（写作回流）跨设备同步
-- 不建这张表也能用，只是「我的例句」只存本机浏览器。
-- 到 Supabase → SQL Editor 粘贴执行即可。

create table if not exists writing_log (
  id      bigint primary key,
  text    text,
  at      timestamptz
);

alter table writing_log enable row level security;

-- 个人自用，anon key 直接放行（与 checkin / daily_counter 同策略）
drop policy if exists writing_log_all on writing_log;
create policy writing_log_all on writing_log
  for all using (true) with check (true);
