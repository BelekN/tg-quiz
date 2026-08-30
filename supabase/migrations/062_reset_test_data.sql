-- ============================================================
-- Обнуление тестовых данных перед реальным запуском (проект ещё не
-- публиковался — играли только друзья разработчика). Стирает игровую
-- историю/результаты и очки/монеты, но НЕ трогает:
--   * сами профили (users.tg_id/username/first_name/photo_url/city/
--     reminders_enabled) — только их игровую статистику;
--   * купленную косметику (user_cosmetics) и что на ком надето
--     (equipped_frame/equipped_badge/avatar_key) — не было явно
--     попрошено, отдельная категория данных от "истории/очков/монет";
--   * платёжные и модерационные логи (star_purchases,
--     coin_adjustments, bug_reports, events) — это аудит/фидбек,
--     а не игровая история.
-- ============================================================

delete from public.duels;             -- cascades: duel_answers
delete from public.solo_sessions;     -- cascades: solo_answers
delete from public.sprint_sessions;   -- cascades: sprint_answers
delete from public.daily_sessions;    -- cascades: daily_answers
delete from public.marathon_sessions; -- cascades: marathon_answers
delete from public.persona_sessions;
delete from public.compat_sessions;   -- cascades: compat_answers

update public.users set
  total_score            = 0,
  coins                  = 0,
  current_streak         = 0,
  longest_streak         = 0,
  longest_marathon_streak = 0,
  last_streak_date       = null,
  updated_at             = now();
