-- ============================================================
-- Адресный вызов, на который никто не ответил 7 дней — удаляем.
-- Чистая SQL-задача без похода во внешний API (как у
-- weekly-leaderboard-reset в 051_weekly_leaderboard.sql) — pg_cron
-- дёргает DELETE напрямую, tg-cron тут не нужен. Тихо, без пуша —
-- тот же принцип, что у decline_duel_challenge.
-- ============================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'expire-stale-duel-challenges') then
    perform cron.unschedule('expire-stale-duel-challenges');
  end if;
end $$;

select cron.schedule(
  'expire-stale-duel-challenges',
  '0 3 * * *',
  $job$
  delete from public.duels
   where status = 'invited' and created_at < now() - interval '7 days';
  $job$
);
