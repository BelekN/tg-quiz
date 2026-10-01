// Собирает supabase/courses/<key>.sql из supabase/courses/<key>.json.
//
// JSON — единственный источник контента курса: его же читает мок-режим
// (src/lib/mock.js) и проверяет src/lib/courseContent.test.js. SQL
// руками не правим — правим JSON и перегенерируем:
//
//   node scripts/build-course-sql.mjs
//
// Ответы итогового теста уезжают в отдельную колонку courses.exam_key,
// которую start_course_day наружу не отдаёт, — тест проверяет сервер.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const dir = fileURLToPath(new URL('../supabase/courses/', import.meta.url))

const lit = (s) => `'${String(s).replaceAll("'", "''")}'`
const jsonb = (v) => `${lit(JSON.stringify(v))}::jsonb`
const textArray = (arr) => (arr.length ? `array[${arr.map(lit).join(', ')}]::text[]` : `'{}'::text[]`)

function build(course) {
  const exam = course.exam.map(({ quote, options }, i) => ({ id: i, quote, options }))
  const examKey = course.exam.map(({ answer, explain }) => ({ answer, explain }))
  const cardKeys = course.cards.map((c) => c.key)
  const days = course.days.map((d) => d.day)

  const out = []
  out.push(`-- СГЕНЕРИРОВАНО scripts/build-course-sql.mjs из ${course.key}.json — руками не править.`)
  out.push('-- Идемпотентно: можно прогонять повторно после правок контента.')
  out.push('begin;')
  out.push('')
  out.push(`insert into public.courses (key, category, title, subtitle, description, icon, total_days, pass_score, exam, exam_key, ord)
values (${lit(course.key)}, ${lit(course.category)}, ${lit(course.title)}, ${lit(course.subtitle)}, ${lit(course.description)}, ${lit(course.icon)},
        ${course.days.length}, ${course.pass_score}, ${jsonb(exam)}, ${jsonb(examKey)}, ${course.ord})
on conflict (key) do update set
  category = excluded.category, title = excluded.title, subtitle = excluded.subtitle, description = excluded.description,
  icon = excluded.icon, total_days = excluded.total_days, pass_score = excluded.pass_score,
  exam = excluded.exam, exam_key = excluded.exam_key, ord = excluded.ord;`)
  out.push('')

  course.cards.forEach((c, i) => {
    out.push(`insert into public.course_cards (course_key, card_key, title, icon, summary, intro_day, review, ord)
values (${lit(course.key)}, ${lit(c.key)}, ${lit(c.title)}, ${lit(c.icon)}, ${lit(c.summary)}, ${c.intro_day}, ${jsonb(c.review)}, ${i + 1})
on conflict (course_key, card_key) do update set
  title = excluded.title, icon = excluded.icon, summary = excluded.summary,
  intro_day = excluded.intro_day, review = excluded.review, ord = excluded.ord;`)
  })
  out.push(`delete from public.course_cards where course_key = ${lit(course.key)} and not (card_key = any(${textArray(cardKeys)}));`)
  out.push('')

  for (const d of course.days) {
    out.push(`insert into public.course_days (course_key, day, title, subtitle, cards, theory, practice)
values (${lit(course.key)}, ${d.day}, ${lit(d.title)}, ${lit(d.subtitle)}, ${textArray(d.cards)}, ${jsonb(d.theory)}, ${jsonb(d.practice)})
on conflict (course_key, day) do update set
  title = excluded.title, subtitle = excluded.subtitle, cards = excluded.cards,
  theory = excluded.theory, practice = excluded.practice;`)
  }
  out.push(`delete from public.course_days where course_key = ${lit(course.key)} and not (day = any(array[${days.join(', ')}]));`)
  out.push('')
  out.push('commit;')
  return out.join('\n') + '\n'
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const course = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
  const target = join(dir, file.replace(/\.json$/, '.sql'))
  writeFileSync(target, build(course))
  console.log(`${file} -> ${target}`)
}
