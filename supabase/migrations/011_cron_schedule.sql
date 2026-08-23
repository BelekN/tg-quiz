-- ----------------------------------------------------------------------
-- pg_cron -> pg_net расписание для tg-cron (пуш-напоминания).
-- Раньше это было настроено вручную через SQL Editor и не попало ни в
-- одну миграцию — на новой базе tg-cron просто никогда бы не вызывался.
-- Идемпотентно: cron.unschedule перед cron.schedule, чтобы повторный
-- прогон не плодил дублирующиеся задания.
-- ----------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'tg-cron-push-notifications') then
    perform cron.unschedule('tg-cron-push-notifications');
  end if;
end $$;

-- ВАЖНО: замени <CRON_SECRET> на то же значение, что задано через
-- `supabase secrets set CRON_SECRET=...` для tg-cron — секрет
-- сознательно не хранится в репозитории.
select cron.schedule(
  'tg-cron-push-notifications',
  '*/30 * * * *',
  $job$
  select net.http_post(
    url := 'https://rckwykzmjvxsvvhvrful.supabase.co/functions/v1/tg-cron',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $job$
);
