-- ------------------------------------------------------------
-- Инвайт на дуэль через inline-режим бота (см. tg-webhook/index.ts,
-- inline_query) рендерится Telegram как чистая карточка с кнопкой —
-- без голой ссылки-текста, которая раньше выглядела как спam/фишинг
-- (see t.me/share/url поведение). Текст карточки собирает сам
-- webhook, а не клиент — этой функцией смотрит реальный host_score,
-- а не то, что клиент передал бы в inline query.
-- ------------------------------------------------------------
create or replace function public.get_duel_host_score(p_duel_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select host_score from public.duels where id = p_duel_id;
$$;

revoke all on function public.get_duel_host_score(uuid) from public, anon, authenticated;
grant execute on function public.get_duel_host_score(uuid) to service_role;
