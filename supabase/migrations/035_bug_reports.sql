-- ============================================================
-- Обращения пользователей ("сообщить о проблеме"). Контекст (код и
-- detail последней ошибки, экран) прикладывается клиентом как jsonb —
-- удобно смотреть в SQL, не нужно парсить текст сообщения руками.
-- ============================================================

create table if not exists public.bug_reports (
  id         uuid primary key default gen_random_uuid(),
  tg_id      bigint  not null references public.users (tg_id) on delete cascade,
  message    text    not null,
  context    jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bug_reports_created_idx
  on public.bug_reports (created_at desc);

alter table public.bug_reports enable row level security;

create or replace function public.report_issue(
  p_tg_id    bigint,
  p_message  text,
  p_context  jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := trim(p_message);
  v_id      uuid;
begin
  if length(v_message) = 0 then
    raise exception 'EMPTY_MESSAGE';
  end if;
  if length(v_message) > 2000 then
    raise exception 'MESSAGE_TOO_LONG';
  end if;

  insert into public.bug_reports (tg_id, message, context)
  values (p_tg_id, v_message, p_context)
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end $$;

revoke all on function public.report_issue(bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.report_issue(bigint, text, jsonb) to service_role;
