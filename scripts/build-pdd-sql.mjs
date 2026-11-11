// Собирает supabase/pdd/questions.sql из supabase/pdd/questions.json.
//
// JSON — единственный источник банка вопросов ПДД: его же читает
// мок-режим (src/lib/mock.js) и проверяет src/lib/pddContent.test.js.
// SQL руками не правим — правим JSON и перегенерируем:
//
//   node scripts/build-pdd-sql.mjs
//
// Вопросы, которых больше нет в JSON, не удаляются, а выключаются
// (is_active = false): на них могут ссылаться прошлые экзамены.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../supabase/pdd/questions.json', import.meta.url))
const target = fileURLToPath(new URL('../supabase/pdd/questions.sql', import.meta.url))

const lit = (s) => (s == null ? 'null' : `'${String(s).replaceAll("'", "''")}'`)
const jsonb = (v) => `${lit(JSON.stringify(v))}::jsonb`
const textArray = (arr) => `array[${arr.map(lit).join(', ')}]::text[]`

const { topics, questions } = JSON.parse(readFileSync(src, 'utf-8'))

const out = []
out.push('-- СГЕНЕРИРОВАНО scripts/build-pdd-sql.mjs из questions.json — руками не править.')
out.push('-- Идемпотентно: можно прогонять повторно после правок контента.')
out.push('begin;')
out.push('')

topics.forEach((t, i) => {
  out.push(`insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values (${lit(t.key)}, ${lit(t.title)}, ${lit(t.icon)}, ${i + 1}, ${t.in_exam !== false}, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;`)
})
out.push(`update public.pdd_topics set is_active = false where not (key = any(${textArray(topics.map((t) => t.key))}));`)
out.push('')

questions.forEach((q, i) => {
  out.push(`insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values (${lit(q.id)}, ${lit(q.topic)}, ${lit(q.question)}, ${lit(q.sign ?? null)}, ${jsonb(q.options)}, ${q.answer}, ${lit(q.explain)}, ${i + 1}, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;`)
})
out.push(`update public.pdd_questions set is_active = false where not (id = any(${textArray(questions.map((q) => q.id))}));`)
out.push('')
out.push('commit;')

writeFileSync(target, out.join('\n') + '\n')
console.log(`questions.json -> ${target} (${topics.length} тем, ${questions.length} вопросов)`)
