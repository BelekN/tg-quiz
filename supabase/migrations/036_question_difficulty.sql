-- ============================================================
-- Уровень сложности вопроса — задел на будущее (фильтрация по
-- сложности, режимы "полегче"/"для экспертов" и т.п.), пока никакой
-- RPC его не читает. Дефолт 'medium' — на случай если где-то
-- проскочит вставка без явного значения.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'question_difficulty'
  ) then
    create type public.question_difficulty as enum ('easy', 'medium', 'hard');
  end if;
end $$;

alter table public.questions
  add column if not exists difficulty public.question_difficulty not null default 'medium';

create index if not exists questions_category_difficulty_idx
  on public.questions (category, difficulty) where is_active;
