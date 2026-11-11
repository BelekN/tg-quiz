-- СГЕНЕРИРОВАНО scripts/build-pdd-sql.mjs из questions.json — руками не править.
-- Идемпотентно: можно прогонять повторно после правок контента.
begin;

insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('priority', 'Знаки приоритета', '🔶', 1, true, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('prohibit', 'Запрещающие знаки', '⛔', 2, true, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('signs', 'Другие знаки', '🪧', 3, true, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('lights', 'Светофор и регулировщик', '🚦', 4, true, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('intersections', 'Проезд перекрёстков', '🔀', 5, true, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('maneuvers', 'Манёвры и обгон', '↪️', 6, true, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('speed', 'Скорость и дистанция', '🏎', 7, true, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('stopping', 'Остановка и стоянка', '🅿️', 8, true, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('pedestrians', 'Пешеходы, переезды, безопасность', '🚶', 9, true, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
insert into public.pdd_topics (key, title, icon, ord, in_exam, is_active)
values ('fines', 'Штрафы', '💸', 10, false, true)
on conflict (key) do update set
  title = excluded.title, icon = excluded.icon, ord = excluded.ord, in_exam = excluded.in_exam, is_active = true;
update public.pdd_topics set is_active = false where not (key = any(array['priority', 'prohibit', 'signs', 'lights', 'intersections', 'maneuvers', 'speed', 'stopping', 'pedestrians', 'fines']::text[]));

insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-01', 'priority', 'Что означает этот знак?', '2.1', '["Главная дорога","Конец главной дороги","Пересечение со второстепенной дорогой","Уступите дорогу"]'::jsonb, 0, 'Жёлтый ромб в белой рамке — «Главная дорога». На нерегулируемых перекрёстках водители со второстепенных дорог обязаны уступать вам.', 1, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-02', 'priority', 'Что означает этот знак?', '2.2', '["Главная дорога","Конец главной дороги","Конец всех ограничений","Дорога с односторонним движением"]'::jsonb, 1, 'Перечёркнутый ромб — «Конец главной дороги». Дальше у вас нет преимущества, и на ближайшем перекрёстке очерёдность проезда определяется заново.', 2, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-03', 'priority', 'Что требует от водителя этот знак?', '2.4', '["Уступить дорогу транспорту на пересекаемой дороге","Обязательно остановиться перед перекрёстком","Уступить дорогу только пешеходам","Снизить скорость до 20 км/ч"]'::jsonb, 0, '«Уступите дорогу» требует пропустить транспорт, движущийся по пересекаемой дороге. Останавливаться, если никому не мешаете, не обязательно.', 3, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-04', 'priority', 'Что требует этот знак?', '2.5', '["Остановиться перед стоп-линией или краем пересекаемой проезжей части и уступить дорогу","Остановиться, только если на перекрёстке есть другие машины","Въезд запрещён","Остановка запрещена"]'::jsonb, 0, '«Движение без остановки запрещено» (STOP): остановка обязательна всегда — перед стоп-линией, а если её нет, перед краем пересекаемой проезжей части. Затем нужно уступить дорогу.', 4, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-05', 'priority', 'О чём предупреждает этот знак?', '2.3.1', '["Пересечение со второстепенной дорогой","Пересечение равнозначных дорог","Железнодорожный переезд","Перекрёсток с круговым движением"]'::jsonb, 0, '«Пересечение со второстепенной дорогой»: вы едете по главной (толстая линия), впереди перекрёсток с второстепенной (тонкая линия).', 5, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-06', 'priority', 'Вы едете по главной дороге, а на перекрёстке впереди работает светофор. Чем руководствоваться?', '2.1', '["Сигналами светофора","Знаками приоритета","Правилом «помеха справа»","Кто первым подъехал, тот и едет"]'::jsonb, 0, 'Когда светофор работает в обычном режиме, перекрёсток регулируемый: знаки приоритета на нём не действуют, решают сигналы светофора.', 6, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-07', 'priority', 'Вы выезжаете со второстепенной дороги под этот знак, перекрёсток пуст и хорошо просматривается. Нужно ли останавливаться?', '2.4', '["Нет, если вы никому не создаёте помех","Да, всегда","Да, но только в тёмное время суток","Да, если едете прямо"]'::jsonb, 0, 'Знак 2.4 обязывает уступить дорогу, а не остановиться. Обязательную остановку требует только знак 2.5 «Движение без остановки запрещено».', 7, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-08', 'priority', 'Перед узким участком дороги стоит круглый знак «Преимущество встречного движения». Навстречу уже едет автомобиль. Как поступить?', null, '["Уступить дорогу встречному автомобилю","Проехать первым","Подать звуковой сигнал и проехать","Разъехаться одновременно, прижавшись вправо"]'::jsonb, 0, 'Знак «Преимущество встречного движения» запрещает въезд на узкий участок, если это помешает встречным машинам. Сначала пропустите их.', 8, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-09', 'priority', 'Что означает синий квадратный знак «Преимущество перед встречным движением»?', null, '["На узком участке встречные водители должны уступить вам","Вы должны уступить встречным","Начало дороги с односторонним движением","На этом участке разрешён обгон"]'::jsonb, 0, 'Этот знак ставят с одной стороны узкого участка в паре со знаком «Преимущество встречного движения» с другой. Преимущество у вас.', 9, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('priority-10', 'priority', 'Этот знак установлен перед карантинным постом, стоп-линии нет. Где нужно остановиться?', '2.5', '["Перед знаком","Только если на посту есть сотрудник","В 50 м перед знаком","Останавливаться не нужно"]'::jsonb, 0, 'Знак «Движение без остановки запрещено» может стоять перед железнодорожным переездом или карантинным постом. Тогда останавливаются перед стоп-линией, а если её нет — перед знаком.', 10, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-01', 'prohibit', 'Что означает этот знак?', '3.1', '["Въезд запрещён","Движение запрещено","Остановка запрещена","Тупик"]'::jsonb, 0, 'Красный круг с белой полосой («кирпич») — «Въезд запрещён». Обычно стоит на выезде с участка с односторонним движением навстречу вам.', 11, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-02', 'prohibit', 'Что означает этот знак?', '3.2', '["Движение запрещено","Въезд запрещён","Конец зоны всех ограничений","Ограничение скорости"]'::jsonb, 0, 'Белый круг с красной каймой без изображения — «Движение запрещено»: запрещено движение транспортных средств (Правила делают отдельные исключения, например для обслуживающего транспорта).', 12, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-03', 'prohibit', 'Что означает этот знак?', '3.24:40', '["Ограничение максимальной скорости 40 км/ч","Рекомендуемая скорость 40 км/ч","Минимальная скорость 40 км/ч","Держать дистанцию не менее 40 м"]'::jsonb, 0, 'Белый круг с красной каймой и числом — «Ограничение максимальной скорости»: ехать быстрее указанной скорости запрещено.', 13, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-04', 'prohibit', 'Что означает этот знак?', '3.25:40', '["Конец ограничения максимальной скорости","Ограничение минимальной скорости","Рекомендуемая скорость","Конец населённого пункта"]'::jsonb, 0, 'Серое число и диагональные полосы — «Конец ограничения максимальной скорости». Дальше действует общее ограничение для этой дороги.', 14, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-05', 'prohibit', 'Что означает этот знак?', '3.27', '["Остановка запрещена","Стоянка запрещена","Въезд запрещён","Стоянка по нечётным числам"]'::jsonb, 0, 'Синий круг с красной каймой и красным крестом — «Остановка запрещена». Под ним нельзя ни стоять, ни останавливаться даже ненадолго.', 15, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-06', 'prohibit', 'Что означает этот знак?', '3.28', '["Стоянка запрещена","Остановка запрещена","Движение запрещено","Место стоянки"]'::jsonb, 0, 'Синий круг с красной каймой и одной красной диагональю — «Стоянка запрещена». Остановка при этом разрешена.', 16, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-07', 'prohibit', 'Можно ли в зоне действия этого знака остановиться, чтобы высадить пассажира?', '3.28', '["Да — знак запрещает стоянку, а не остановку","Нет, остановка тоже запрещена","Только с включённой аварийной сигнализацией","Только на 1 минуту"]'::jsonb, 0, 'Знак «Стоянка запрещена» не запрещает остановку — в том числе для посадки и высадки пассажиров. Остановку запрещает знак с крестом.', 17, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-08', 'prohibit', 'Что означает этот знак?', '3.31', '["Конец всех ограничений","Движение запрещено","Конец главной дороги","Конец дороги с односторонним движением"]'::jsonb, 0, 'Белый круг с несколькими диагональными полосами — «Конец всех ограничений»: одновременно заканчивается действие нескольких запрещающих знаков — ограничения скорости, запрета обгона, остановки и стоянки и других.', 18, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-09', 'prohibit', 'Что запрещает этот знак?', '3.18.1', '["Поворот направо","Движение прямо","Поворот налево","Разворот"]'::jsonb, 0, 'Перечёркнутая стрелка направо — «Поворот направо запрещён» на перекрёстке, перед которым установлен знак.', 19, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-10', 'prohibit', 'Что запрещает этот знак?', '3.19', '["Разворот","Поворот налево","Обгон","Движение задним ходом"]'::jsonb, 0, 'Перечёркнутая U-образная стрелка — «Разворот запрещён».', 20, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('prohibit-11', 'prohibit', 'Знак установлен посреди квартала. Где заканчивается его действие, если других знаков нет?', '3.24:60', '["На ближайшем перекрёстке за знаком","Через 100 м после знака","Только у знака «Конец зоны ограничения»","На следующем светофоре"]'::jsonb, 0, 'Зона действия знака ограничения скорости — до ближайшего перекрёстка за ним, а в населённом пункте при отсутствии перекрёстков — до конца населённого пункта.', 21, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-01', 'signs', 'Что означает этот знак?', '4.1.1', '["Движение прямо","Дорога с односторонним движением","Главная дорога","Обгон разрешён"]'::jsonb, 0, 'Синий круг со стрелкой — предписывающий знак «Движение прямо»: поворачивать на этом перекрёстке нельзя.', 22, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-02', 'signs', 'Что означает этот знак?', '4.1.2', '["Движение только направо","Поворот направо запрещён","Объезд препятствия справа","Крутой поворот"]'::jsonb, 0, 'Предписывающий знак «Движение направо»: на перекрёстке разрешён только поворот направо.', 23, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-03', 'signs', 'Что означает этот знак?', '5.5', '["Дорога с односторонним движением","Движение прямо","Выезд на автомагистраль","Полоса для маршрутных транспортных средств"]'::jsonb, 0, 'Синий квадрат со стрелкой — знак особых предписаний «Дорога с односторонним движением»: по всей ширине дороги транспорт идёт в одну сторону.', 24, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-04', 'signs', 'Чем круглый синий знак «Движение прямо» отличается от квадратного «Дорога с односторонним движением»?', null, '["Круглый предписывает, куда ехать на перекрёстке, а квадратный сообщает, что вся дорога односторонняя","Ничем, это одно и то же","Круглый действует только днём","Квадратный запрещает обгон"]'::jsonb, 0, 'Круглые синие знаки — предписывающие: разрешают только указанные направления. Квадратный 5.5 информирует об одностороннем движении и не запрещает повороты.', 25, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-05', 'signs', 'Что означает этот знак?', '6.4', '["Место стоянки","Стоянка запрещена","Пункт полиции","Платная дорога"]'::jsonb, 0, 'Синий квадрат с буквой «P» — информационный знак «Место стоянки» (парковка).', 26, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-06', 'signs', 'Что означает этот знак?', '1.33', '["Прочие опасности","Аварийно-опасный участок","Конец всех ограничений","Опасный поворот"]'::jsonb, 0, 'Треугольник с восклицательным знаком — «Прочие опасности»: впереди опасность, о которой не предупреждают другие знаки.', 27, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-07', 'signs', 'Что означает этот знак?', '5.23.1:БИШКЕК', '["Начало населённого пункта — действуют правила для населённых пунктов","Указатель направления на город","Конец населённого пункта","Расстояние до города"]'::jsonb, 0, 'Белый знак с названием — «Начало населённого пункта». С него действуют требования Правил о движении в населённых пунктах, в том числе ограничение скорости.', 28, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-08', 'signs', 'Что означает этот знак?', '5.24.1:БИШКЕК', '["Конец населённого пункта","Начало населённого пункта","Въезд в город запрещён","Объезд города"]'::jsonb, 0, 'Название, перечёркнутое красной линией, — «Конец населённого пункта». Требования для населённых пунктов здесь перестают действовать.', 29, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-09', 'signs', 'Как выглядят предупреждающие знаки?', '1.33', '["Белый треугольник с красной каймой","Белый круг с красной каймой","Синий круг","Синий прямоугольник"]'::jsonb, 0, 'Предупреждающие знаки — треугольные с красной каймой. Круглые с красной каймой — запрещающие, синие круглые — предписывающие.', 30, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('signs-10', 'signs', 'Временный знак (на жёлтом фоне, в месте дорожных работ) противоречит постоянному. Каким руководствоваться?', null, '["Временным","Постоянным","Тем, который ближе к дороге","Любым на выбор"]'::jsonb, 0, 'Жёлтый фон означает, что знак временный — его ставят в местах дорожных работ. Если временный и постоянный знаки противоречат друг другу, водитель руководствуется временным.', 31, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-01', 'lights', 'Что означает жёлтый сигнал светофора?', null, '["Запрещает движение, кроме случая, когда остановиться можно только экстренным торможением","Разрешает движение с осторожностью","Предупреждает, что сейчас загорится зелёный, — можно трогаться","Разрешает только поворот направо"]'::jsonb, 0, 'Жёлтый — запрещающий сигнал. Продолжить движение можно, только если вы уже не успеваете остановиться без экстренного торможения.', 32, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-02', 'lights', 'Что означает мигающий жёлтый сигнал светофора?', null, '["Движение разрешено, перекрёсток нерегулируемый — будьте внимательны","Движение запрещено","Светофор сломан, нужно остановиться","Сейчас загорится красный"]'::jsonb, 0, 'Мигающий жёлтый разрешает движение и предупреждает о нерегулируемом перекрёстке или опасном участке. Очерёдность определяют знаки приоритета или правило «помеха справа».', 33, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-03', 'lights', 'Одновременно горят красный и жёлтый сигналы. Что это значит?', null, '["Движение запрещено, скоро включится зелёный","Можно начинать движение","Светофор неисправен","Разрешён только поворот направо"]'::jsonb, 0, 'Красный вместе с жёлтым — по-прежнему запрещающий сигнал. Он лишь предупреждает, что скоро включится зелёный.', 34, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-04', 'lights', 'Что означает мигающий зелёный сигнал?', null, '["Движение разрешено, но скоро включится запрещающий сигнал","Движение запрещено","Нужно уступить пешеходам","Светофор переходит в режим мигающего жёлтого"]'::jsonb, 0, 'Мигающий зелёный разрешает движение и сообщает, что его время истекает. Оцените, успеете ли проехать, — или готовьтесь остановиться.', 35, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-05', 'lights', 'На основном светофоре красный, а в дополнительной секции горит зелёная стрелка направо. Можно ли повернуть?', null, '["Да, уступив дорогу транспорту с других направлений","Да, у вас преимущество","Нет, пока горит красный","Только если нет пешеходов"]'::jsonb, 0, 'Включённая дополнительная секция разрешает движение по стрелке, но преимущества не даёт: нужно уступить транспорту, движущемуся с других направлений.', 36, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-06', 'lights', 'Регулировщик поднял руку вверх. Что это значит?', null, '["Движение запрещено всем, кроме тех, кто не может остановиться без экстренного торможения","Движение разрешено во всех направлениях","Разрешено ехать только прямо","Внимание, сейчас будет смена сигнала — можно ехать"]'::jsonb, 0, 'Поднятая вверх рука — аналог жёлтого сигнала светофора: движение запрещено всем участникам, кроме тех, кто уже не может остановиться.', 37, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-07', 'lights', 'Регулировщик стоит к вам грудью, руки вытянуты в стороны. Можно ли ехать?', null, '["Нет, движение запрещено","Да, только прямо","Да, только направо","Да, во всех направлениях"]'::jsonb, 0, 'Когда регулировщик стоит к вам грудью или спиной с вытянутыми в стороны или опущенными руками, движение с этих сторон запрещено.', 38, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-08', 'lights', 'Регулировщик стоит к вам левым боком, руки вытянуты в стороны. Куда можно ехать на автомобиле?', null, '["Прямо и направо","Только налево","Во всех направлениях","Движение запрещено"]'::jsonb, 0, 'Со стороны левого и правого бока при вытянутых в стороны или опущенных руках безрельсовому транспорту разрешено ехать прямо и направо.', 39, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-09', 'lights', 'Регулировщик стоит к вам левым боком, правая рука вытянута вперёд. Куда можно ехать на автомобиле?', null, '["Во всех направлениях","Только прямо","Только направо","Движение запрещено"]'::jsonb, 0, 'Правая рука вытянута вперёд: со стороны левого бока безрельсовому транспорту разрешено движение во всех направлениях, со стороны груди — только направо, со стороны спины и правого бока — запрещено.', 40, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('lights-10', 'lights', 'Сигналы регулировщика противоречат сигналам светофора и знакам. Что выполнять?', null, '["Сигналы регулировщика","Сигналы светофора","Требования знаков","То, что безопаснее на ваш взгляд"]'::jsonb, 0, 'Сигналы регулировщика главнее всего: они имеют приоритет и над светофором, и над знаками приоритета.', 41, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-01', 'intersections', 'Нерегулируемый перекрёсток равнозначных дорог, знаков нет. Кому вы должны уступить?', null, '["Транспорту, приближающемуся справа","Транспорту, приближающемуся слева","Тому, кто едет быстрее","Никому, если едете прямо"]'::jsonb, 0, 'На перекрёстке равнозначных дорог действует правило «помеха справа»: уступает тот, у кого другой автомобиль приближается справа.', 42, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-02', 'intersections', 'Вы поворачиваете налево на зелёный сигнал. Кому нужно уступить дорогу?', null, '["Встречному транспорту, едущему прямо или направо","Никому — у вас зелёный","Только трамваю","Транспорту справа"]'::jsonb, 0, 'При повороте налево или развороте на зелёный сигнал нужно уступить встречному транспорту, движущемуся прямо и направо.', 43, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-03', 'intersections', 'Поворачивая направо или налево, водитель обязан уступить дорогу…', null, '["Пешеходам и велосипедистам, пересекающим дорогу, на которую он поворачивает","Только пешеходам на регулируемом переходе","Никому, если у него зелёный","Только транспорту справа"]'::jsonb, 0, 'При повороте пешеходы и велосипедисты, пересекающие проезжую часть, на которую вы поворачиваете, имеют преимущество.', 44, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-04', 'intersections', 'На нерегулируемом перекрёстке равнозначных дорог встречаются автомобиль и трамвай. У кого преимущество?', null, '["У трамвая, независимо от направления движения","У того, кто справа","У автомобиля","У того, кто поворачивает направо"]'::jsonb, 0, 'На перекрёстке равнозначных дорог трамвай имеет преимущество перед безрельсовым транспортом независимо от направления движения.', 45, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-05', 'intersections', 'Горит зелёный, но за перекрёстком образовался затор. Можно ли въезжать на перекрёсток?', null, '["Нет, если придётся остановиться на перекрёстке и помешать поперечному движению","Да, зелёный разрешает","Да, если включить аварийную сигнализацию","Да, если вы на главной дороге"]'::jsonb, 0, 'Въезжать на перекрёсток при заторе запрещено даже на зелёный: остановившись на нём, вы перекроете дорогу поперечному транспорту.', 46, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-06', 'intersections', 'Вы въехали на перекрёсток на зелёный, а на выезде с него загорелся красный. Как поступить?', null, '["Выехать с перекрёстка в намеченном направлении","Остановиться и ждать зелёного","Сдать назад","Включить аварийку и стоять"]'::jsonb, 0, 'Водитель, въехавший на перекрёсток на разрешающий сигнал, должен выехать в намеченном направлении независимо от сигналов светофора на выходе.', 47, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-07', 'intersections', 'Вы выезжаете на дорогу из двора (с прилегающей территории). Кому нужно уступить?', null, '["Транспорту и пешеходам, движущимся по дороге","Только транспорту слева","Никому, если вы справа","Только пешеходам"]'::jsonb, 0, 'Выезжая с прилегающей территории (двор, АЗС, стоянка), водитель уступает всем, кто движется по дороге, — и транспорту, и пешеходам.', 48, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-08', 'intersections', 'Перекрёсток равнозначных дорог. Вы поворачиваете налево, встречный автомобиль едет прямо, справа подъезжает ещё один. Кому вы уступаете?', null, '["Обоим","Только встречному","Только тому, что справа","Никому"]'::jsonb, 0, 'Автомобилю справа — по правилу «помеха справа». Встречному, едущему прямо, — потому что при повороте налево вы уступаете встречному транспорту.', 49, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-09', 'intersections', 'Включился зелёный, но пешеходы ещё не закончили переход. Ваши действия?', null, '["Дать им закончить переход и только потом ехать","Ехать — у вас зелёный","Посигналить, чтобы поторопить","Объехать пешеходов"]'::jsonb, 0, 'При включении разрешающего сигнала водитель обязан уступить пешеходам, не закончившим переход, и транспорту, завершающему проезд перекрёстка.', 50, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-10', 'intersections', 'Ночью, в грязь или снег вы не можете понять, есть ли покрытие на вашей дороге, а знаков приоритета нет. Как себя считать?', null, '["Находящимся на второстепенной дороге","Находящимся на главной дороге","Перекрёсток равнозначный","Как удобнее"]'::jsonb, 0, 'Если водитель не может определить наличие покрытия на дороге, а знаков приоритета нет, он должен считать, что находится на второстепенной дороге.', 51, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('intersections-11', 'intersections', 'К перекрёстку равнозначных дорог одновременно подъехали машины со всех четырёх сторон. Как разъехаться?', null, '["Один из водителей предупреждает остальных (например, звуковым сигналом), что проедет первым, дальше — по правилу «помеха справа»","Все ждут, пока кто-то не уедет","Первым едет тот, кто поворачивает направо","Первым едет самая большая машина"]'::jsonb, 0, 'Правила КР прямо описывают этот случай: один из водителей звуковым сигналом или другим способом предупреждает остальных, что проедет первым. Дальше все разъезжаются по правилам для равнозначных перекрёстков.', 52, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-01', 'maneuvers', 'Даёт ли включённый указатель поворота преимущество при манёвре?', null, '["Нет, сигнал не даёт преимущества и не освобождает от мер предосторожности","Да, после сигнала все обязаны пропустить","Да, если сигнал включён заранее","Да, но только в населённом пункте"]'::jsonb, 0, 'Указатель поворота лишь предупреждает о манёвре. Совершать его можно, только убедившись, что он безопасен и не мешает другим.', 53, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-02', 'maneuvers', 'Вы и автомобиль справа одновременно перестраиваетесь в одну и ту же полосу. Кто уступает?', null, '["Вы — уступает тот, у кого другой автомобиль справа","Автомобиль справа","Тот, кто едет медленнее","Тот, кто позже включил поворотник"]'::jsonb, 0, 'При одновременном перестроении попутных транспортных средств уступает тот водитель, у которого другое транспортное средство находится справа.', 54, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-03', 'maneuvers', 'Где обгон запрещён?', null, '["На пешеходном переходе","На любой дороге с двумя полосами","На прямом участке за городом","На главной дороге с хорошей видимостью"]'::jsonb, 0, 'Обгон запрещён на пешеходных переходах, железнодорожных переездах и ближе 100 м перед ними, на регулируемых перекрёстках, на мостах и в тоннелях, в конце подъёма и на участках с ограниченной видимостью.', 55, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-04', 'maneuvers', 'Что запрещено водителю, которого обгоняют?', null, '["Препятствовать обгону — повышать скорость или мешать иначе","Ехать с прежней скоростью","Смещаться вправо","Включать ближний свет"]'::jsonb, 0, 'Водителю обгоняемого транспорта запрещено мешать обгону — повышением скорости или другими действиями.', 56, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-05', 'maneuvers', 'Когда разрешено обгонять справа?', null, '["Когда обгоняемый подал сигнал поворота налево и начал поворот","Всегда на дороге с несколькими полосами","Никогда","Когда слева мешает встречный транспорт"]'::jsonb, 0, 'Обгон совершается слева. Справа можно обогнать только того, кто подал сигнал поворота налево и приступил к повороту.', 57, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-06', 'maneuvers', 'Где запрещён разворот?', null, '["На пешеходном переходе","На любом перекрёстке","На дороге с двумя полосами","На прямом участке с хорошей видимостью"]'::jsonb, 0, 'Разворот запрещён на пешеходных переходах, в тоннелях, на мостах и под ними, на железнодорожных переездах, в местах с плохой видимостью и у остановок общественного транспорта.', 58, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-07', 'maneuvers', 'Перед поворотом направо водитель должен…', null, '["Заблаговременно занять крайнее правое положение на проезжей части","Занять среднюю полосу","Сместиться влево, чтобы шире зайти в поворот","Остановиться перед перекрёстком"]'::jsonb, 0, 'Перед поворотом направо нужно заранее занять крайнее правое положение, налево и на разворот — крайнее левое (если нет других указаний разметкой или знаками).', 59, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-08', 'maneuvers', 'Где запрещено движение задним ходом?', null, '["На перекрёстках и там, где запрещён разворот","В жилой зоне","На любой дороге с разметкой","Только ночью"]'::jsonb, 0, 'Задним ходом нельзя двигаться на перекрёстках и в местах, где запрещён разворот. В остальных местах — только убедившись в безопасности.', 60, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-09', 'maneuvers', 'Можно ли пересекать сплошную линию разметки, разделяющую встречные потоки?', null, '["Нет, её пересекать запрещено","Да, при обгоне","Да, если нет встречных машин","Да, при развороте"]'::jsonb, 0, 'Сплошную линию, разделяющую встречные потоки, пересекать нельзя — ни для обгона, ни для поворота или разворота.', 61, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-10', 'maneuvers', 'Когда нужно включать указатель поворота?', null, '["Заблаговременно — перед началом движения, перестроением, поворотом, разворотом и остановкой","Только перед поворотом на перекрёстке","Только если сзади есть машины","Уже во время манёвра"]'::jsonb, 0, 'Сигнал подают заранее, до начала манёвра, и выключают сразу после его окончания. Он не должен вводить других в заблуждение.', 62, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('maneuvers-11', 'maneuvers', 'Траектории двух машин пересекаются, а очерёдность проезда Правилами не оговорена. Кто уступает?', null, '["Тот, к кому другая машина приближается справа","Тот, кто едет медленнее","Тот, у кого машина меньше","Тот, кто позже начал манёвр"]'::jsonb, 0, 'Если очерёдность не установлена, дорогу уступает водитель, к которому транспортное средство приближается справа.', 63, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-01', 'speed', 'Как выбирать скорость движения?', null, '["С учётом интенсивности движения, состояния машины и груза, дороги, погоды и видимости — не выше ограничения","Всегда максимально разрешённую","По скорости соседнего потока, даже если это выше ограничения","Как удобно водителю"]'::jsonb, 0, 'Скорость должна позволять постоянно контролировать движение. Ограничение — это верхний предел, а не рекомендуемая скорость.', 64, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-02', 'speed', 'Впереди возникла опасность, которую вы в состоянии обнаружить. Что вы обязаны сделать?', null, '["Принять меры к снижению скорости вплоть до остановки","Объехать препятствие любым способом","Подать звуковой сигнал и продолжить движение","Включить аварийную сигнализацию"]'::jsonb, 0, 'При опасности Правила требуют снижать скорость вплоть до остановки. Резкий объезд часто опаснее торможения.', 65, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-03', 'speed', 'Какую дистанцию до впереди идущего автомобиля нужно держать?', null, '["Такую, чтобы избежать столкновения, если он резко затормозит","Ровно 10 метров","Не меньше длины одного автомобиля","Дистанция не регламентирована"]'::jsonb, 0, 'Точной цифры в Правилах нет: дистанция должна позволять избежать столкновения при внезапном торможении. Удобный ориентир — не меньше 2 секунд, в дождь больше.', 66, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-04', 'speed', 'Какая максимальная скорость разрешена легковому автомобилю после этого знака, если других знаков нет?', '5.23.1:БИШКЕК', '["60 км/ч","40 км/ч","70 км/ч","90 км/ч"]'::jsonb, 0, 'В населённых пунктах разрешается движение со скоростью не более 60 км/ч, если знаки не устанавливают другое ограничение.', 67, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-05', 'speed', 'Можно ли без необходимости ехать слишком медленно?', null, '["Нет, если это мешает другим транспортным средствам","Да, медленнее — всегда безопаснее","Да, в правой полосе можно как угодно","Нет, скорость не может быть ниже 40 км/ч"]'::jsonb, 0, 'Правила запрещают без необходимости двигаться со слишком малой скоростью, создавая помехи другим.', 68, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-06', 'speed', 'Когда допустимо резкое торможение?', null, '["Только когда это необходимо, чтобы предотвратить ДТП","Когда нужно быстро припарковаться","Чтобы проучить того, кто едет слишком близко","Всегда, если сзади никого нет"]'::jsonb, 0, 'Резко тормозить запрещено, если это не нужно для предотвращения дорожно-транспортного происшествия.', 69, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-07', 'speed', 'Как изменится тормозной путь, если скорость увеличить в два раза?', null, '["Увеличится примерно в 4 раза","Увеличится в 2 раза","Не изменится","Увеличится на 20%"]'::jsonb, 0, 'Тормозной путь растёт пропорционально квадрату скорости: вдвое быстрее — примерно вчетверо длиннее торможение.', 70, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-08', 'speed', 'Почему на мокрой или скользкой дороге нужно увеличить дистанцию?', null, '["Сцепление шин с дорогой хуже, тормозной путь длиннее","Так требует только знак «Скользкая дорога»","Чтобы на машину не летели брызги","Не нужно, если шины новые"]'::jsonb, 0, 'На мокром асфальте тормозной путь растёт в разы, на льду — ещё сильнее. Дистанцию и скорость нужно выбирать с запасом.', 71, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-09', 'speed', 'На большой скорости по луже машина «поплыла» и перестала слушаться руля (аквапланирование). Что делать?', null, '["Плавно сбросить газ, не тормозить резко и держать руль прямо","Резко нажать на тормоз","Резко повернуть руль","Добавить газу"]'::jsonb, 0, 'При аквапланировании шины теряют контакт с дорогой. Плавное снижение скорости возвращает сцепление, а резкие действия приводят к заносу.', 72, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-10', 'speed', 'С какой максимальной скоростью можно ехать на легковом автомобиле вне населённого пункта по обычной дороге (не автомагистрали)?', null, '["90 км/ч","110 км/ч","80 км/ч","100 км/ч"]'::jsonb, 0, 'Вне населённых пунктов легковым автомобилям разрешено не более 90 км/ч, на автомагистралях — не более 110 км/ч, если знаки не устанавливают другое.', 73, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-11', 'speed', 'Какая максимальная скорость разрешена легковому автомобилю на автомагистрали?', null, '["110 км/ч","90 км/ч","130 км/ч","150 км/ч"]'::jsonb, 0, 'На автомагистралях легковым автомобилям и грузовым до 3,5 т разрешено не более 110 км/ч.', 74, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('speed-12', 'speed', 'С какой максимальной скоростью может ехать водитель со стажем меньше 2 лет?', null, '["Не более 70 км/ч на всех дорогах","Не более 90 км/ч вне населённых пунктов","Не более 60 км/ч на всех дорогах","Ограничений для новичков нет"]'::jsonb, 0, 'В Кыргызстане водителям со стажем до 2 лет разрешено ехать не быстрее 70 км/ч на любых дорогах — даже там, где остальным можно 90 или 110.', 75, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-01', 'stopping', 'Где запрещена остановка?', null, '["На пешеходном переходе и ближе 5 м перед ним","Только на самом переходе","Ближе 50 м от перехода","Остановка у перехода разрешена, если быстро"]'::jsonb, 0, 'Остановка запрещена на пешеходных переходах и ближе 5 м перед ними: стоящая машина закрывает пешеходов от других водителей.', 76, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-02', 'stopping', 'Можно ли остановиться на перекрёстке?', null, '["Нет — остановка запрещена на перекрёстках и ближе 5 м от края пересекаемой проезжей части","Да, если включить аварийку","Да, на 1–2 минуты","Да, если нет светофора"]'::jsonb, 0, 'На перекрёстках и ближе 5 м от края пересекаемой проезжей части остановка запрещена: машина закрывает обзор и мешает поворачивающим.', 77, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-03', 'stopping', 'Где ещё запрещена остановка?', null, '["На железнодорожных переездах и в тоннелях","На любой дороге с двумя полосами","У жилых домов","Возле магазинов"]'::jsonb, 0, 'Остановка запрещена на железнодорожных переездах, в тоннелях, на эстакадах и мостах, а также там, где машина помешает другим или закроет сигналы и знаки.', 78, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-04', 'stopping', 'Чем остановка отличается от стоянки?', null, '["Остановка — до 5 минут или дольше, если нужно для посадки-высадки пассажиров или погрузки-разгрузки","Остановка — с выключенным двигателем, стоянка — с включённым","Ничем","Остановка — только на обочине"]'::jsonb, 0, 'Остановка — прекращение движения до 5 минут, а также дольше, если это нужно для посадки или высадки пассажиров, погрузки или разгрузки. Всё остальное — стоянка.', 79, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-05', 'stopping', 'Где нужно останавливаться на дороге с двусторонним движением?', null, '["Справа по ходу движения, у края проезжей части или на обочине","На любой стороне дороги","Посередине своей полосы","Слева, если там больше места"]'::jsonb, 0, 'Останавливаться и ставить машину на стоянку можно по правой стороне дороги — на обочине, а если её нет, у края проезжей части.', 80, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-06', 'stopping', 'Машина сломалась там, где остановка запрещена. Что делать?', null, '["Включить аварийную сигнализацию, выставить знак аварийной остановки и принять меры, чтобы убрать машину","Ничего — поломка оправдывает остановку","Только включить ближний свет","Оставить машину и вызвать эвакуатор позже"]'::jsonb, 0, 'При вынужденной остановке в запрещённом месте нужно обозначить машину (аварийка и знак аварийной остановки) и принять все меры, чтобы отвести её.', 81, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-07', 'stopping', 'Можно ли открыть дверь машины, не посмотрев назад?', null, '["Нет, нельзя открывать двери, если это помешает другим участникам движения","Да, если стоите у бордюра","Да, если машина на стоянке","Да, если включена аварийка"]'::jsonb, 0, 'Открывать двери можно, только убедившись, что это не создаст помех — например, проезжающему велосипедисту или автомобилю.', 82, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-08', 'stopping', 'Что должен сделать водитель, покидая автомобиль?', null, '["Принять меры, исключающие самопроизвольное движение и использование машины в его отсутствие","Только выключить двигатель","Только закрыть окна","Ничего, если отходит ненадолго"]'::jsonb, 0, 'Покидая машину, нужно затянуть стояночный тормоз, выключить двигатель, забрать ключ и запереть машину — чтобы она не покатилась и её не угнали.', 83, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-09', 'stopping', 'Можно ли под этим знаком остановиться на минуту, чтобы высадить пассажира?', '3.27', '["Нет, остановка запрещена","Да, высадка пассажиров разрешена","Да, с включённой аварийной сигнализацией","Да, если водитель не выходит из машины"]'::jsonb, 0, 'Знак «Остановка запрещена» запрещает любую остановку — даже на минуту и даже для высадки пассажиров.', 84, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-10', 'stopping', 'Можно ли остановиться в 10 м от остановки автобуса, если это помешает автобусам?', null, '["Нет, остановка запрещена ближе 15 м от остановки маршрутного транспорта, если создаёт помехи","Да, на 5 минут можно","Да, если не выходить из машины","Нет, ближе 50 м запрещено всегда"]'::jsonb, 0, 'Остановка и стоянка запрещены ближе 15 м от остановочной площадки (или указателя остановки маршрутного транспорта и такси), если это создаёт помехи их движению.', 85, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-11', 'stopping', 'На каком расстоянии от железнодорожного переезда запрещена стоянка?', null, '["Ближе 50 м","Ближе 15 м","Ближе 100 м","Ближе 5 м"]'::jsonb, 0, 'Стоянка запрещена ближе 50 м от железнодорожных переездов. А на самом переезде запрещена и остановка.', 86, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('stopping-12', 'stopping', 'На каком расстоянии от машины выставить знак аварийной остановки?', null, '["Не менее 15 м в населённом пункте и 30 м вне его","Не менее 5 м везде","Не менее 50 м везде","Вплотную к машине"]'::jsonb, 0, 'Знак ставят так, чтобы вовремя предупредить других водителей, но не ближе 15 м от машины в населённом пункте и 30 м — вне населённого пункта.', 87, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-01', 'pedestrians', 'Вы подъезжаете к нерегулируемому пешеходному переходу, пешеход начал переходить дорогу. Ваши действия?', null, '["Уступить дорогу пешеходу","Проехать перед ним, если успеваете","Подать звуковой сигнал","Объехать пешехода"]'::jsonb, 0, 'Перед нерегулируемым переходом водитель обязан снизить скорость или остановиться, чтобы пропустить пешеходов, переходящих дорогу или вступивших на неё.', 88, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-02', 'pedestrians', 'Перед нерегулируемым переходом в соседней полосе остановилась машина. Можно ли продолжать движение?', null, '["Только убедившись, что перед ней нет пешеходов","Да, без ограничений","Нет, ехать можно только после неё","Да, подав звуковой сигнал"]'::jsonb, 0, 'Машина могла остановиться, чтобы пропустить пешехода, которого вам не видно. Продолжать движение можно, только убедившись, что перед ней никого нет.', 89, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-03', 'pedestrians', 'Дорогу переходит пешеход с белой тростью. Что должен сделать водитель?', null, '["Снизить скорость или остановиться и пропустить его","Подать звуковой сигнал","Объехать на безопасном расстоянии","Ехать дальше — пешеход переходит вне перехода"]'::jsonb, 0, 'Белая трость означает, что человек незрячий или слабовидящий. Водитель обязан пропустить его в любом месте.', 90, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-04', 'pedestrians', 'Автобус со знаком «Перевозка детей» остановился и включил аварийную сигнализацию. Ваши действия?', null, '["Снизить скорость и при необходимости остановиться, чтобы пропустить детей","Объехать его, не снижая скорости","Подать звуковой сигнал","Обогнать его, пока дети не вышли"]'::jsonb, 0, 'Дети могут выбежать из-за автобуса неожиданно. Нужно снизить скорость и быть готовым остановиться.', 91, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-05', 'pedestrians', 'Шлагбаум на железнодорожном переезде поднят, но мигают красные сигналы светофора. Можно ли проезжать?', null, '["Нет, движение через переезд запрещено","Да, шлагбаум открыт","Да, если поезда не видно","Да, на небольшой скорости"]'::jsonb, 0, 'Запрещающий сигнал светофора на переезде запрещает въезд независимо от положения шлагбаума и наличия поезда в поле зрения.', 92, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-06', 'pedestrians', 'Где нужно остановиться перед переездом, если движение запрещено, а стоп-линии и знаков нет?', null, '["Не ближе 5 м от шлагбаума, а если его нет — не ближе 10 м от ближайшего рельса","Вплотную к шлагбауму","В 1 м от рельсов","Где угодно перед переездом"]'::jsonb, 0, 'Если нет стоп-линии, знака «Движение без остановки запрещено» и светофора, остановитесь не ближе 5 м от шлагбаума, а без шлагбаума — не ближе 10 м до ближайшего рельса.', 93, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-07', 'pedestrians', 'Сзади едет автомобиль с синим проблесковым маячком и специальным звуковым сигналом. Что делать?', null, '["Уступить ему дорогу","Продолжать движение — у вас своя полоса","Остановиться посреди полосы","Ускориться, чтобы не мешать"]'::jsonb, 0, 'Транспорту с одновременно включёнными синим маячком и сиреной обязаны уступить дорогу все водители.', 94, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-08', 'pedestrians', 'Автомобиль заглох прямо на железнодорожном переезде. Что делать в первую очередь?', null, '["Немедленно высадить людей и принять меры к освобождению переезда","Пытаться завести двигатель, оставаясь в машине","Позвонить в сервис","Включить аварийку и ждать помощи в салоне"]'::jsonb, 0, 'Сначала — люди: всех высадить и отвести от переезда. Затем освобождать переезд, а если не получается — подать сигнал остановки машинисту приближающегося поезда.', 95, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-09', 'pedestrians', 'Можно ли разговаривать по телефону за рулём?', null, '["Только через гарнитуру или громкую связь, не держа телефон в руках","Да, если ехать медленно","Да, на светофоре во время движения","Да, если разговор короткий"]'::jsonb, 0, 'Во время движения нельзя пользоваться телефоном, держа его в руке. Говорить можно только через устройство, позволяющее вести переговоры без рук.', 96, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-10', 'pedestrians', 'Кто обязан пристёгиваться ремнём безопасности?', null, '["Водитель и все пассажиры, если машина оборудована ремнями","Только водитель","Только пассажир на переднем сиденье","Только за городом"]'::jsonb, 0, 'Пристёгнуты должны быть и водитель, и пассажиры — на передних и задних сиденьях, если ремни предусмотрены конструкцией.', 97, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('pedestrians-11', 'pedestrians', 'Впереди на обочине стоит машина с включённым синим проблесковым маячком. Что делать?', null, '["Снизить скорость, чтобы при необходимости сразу остановиться","Проехать, не меняя скорости","Обязательно остановиться","Подать звуковой сигнал"]'::jsonb, 0, 'Приближаясь к стоящей машине с синим маячком, водитель должен снизить скорость так, чтобы при необходимости немедленно остановиться.', 98, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-01', 'fines', 'Какой штраф за превышение скорости на 20–40 км/ч?', null, '["3 000 сом","1 000 сом","7 500 сом","500 сом"]'::jsonb, 0, 'Превышение на 20–40 км/ч — 3 000 сом (ст. 187 КоП). При оплате в течение 30 дней — 900 сом.', 99, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-02', 'fines', 'Какой штраф за превышение скорости на 10–20 км/ч?', null, '["1 000 сом","3 000 сом","Только предупреждение","5 500 сом"]'::jsonb, 0, 'Превышение на 10–20 км/ч — 1 000 сом (ст. 187 КоП), со скидкой при оплате в течение 30 дней — 300 сом.', 100, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-03', 'fines', 'Какой штраф за превышение скорости больше чем на 60 км/ч?', null, '["15 000 сом, без скидки","7 500 сом","5 500 сом со скидкой 70%","3 000 сом"]'::jsonb, 0, 'Превышение более чем на 60 км/ч — 15 000 сом (ст. 187 КоП). Скидка за быструю оплату здесь не действует, как и при превышении на 40–60 км/ч (7 500 сом).', 101, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-04', 'fines', 'Какой штраф за проезд на красный сигнал светофора?', null, '["5 500 сом","1 000 сом","3 000 сом","15 000 сом"]'::jsonb, 0, 'Проезд на красный — 5 500 сом (ст. 188 КоП), со скидкой — 1 650 сом. А заезд за стоп-линию на запрещающий сигнал — 1 000 сом.', 102, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-05', 'fines', 'Какой штраф за разговор по телефону за рулём без гарнитуры?', null, '["3 000 сом","1 000 сом","5 500 сом","Штрафа нет"]'::jsonb, 0, 'Телефон за рулём без устройства «свободные руки» — 3 000 сом (ст. 188 КоП), со скидкой — 900 сом.', 103, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-06', 'fines', 'Какой штраф, если водитель не пристёгнут ремнём безопасности?', null, '["1 000 сом","3 000 сом","500 сом","Только предупреждение"]'::jsonb, 0, 'Непристёгнутый ремень — 1 000 сом (ст. 182 КоП), со скидкой — 300 сом.', 104, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-07', 'fines', 'Какой штраф за выезд на полосу встречного движения?', null, '["15 000 сом, без скидки","3 000 сом","5 500 сом","1 000 сом"]'::jsonb, 0, 'Выезд на встречную полосу — 15 000 сом (ст. 188 КоП), скидки за быструю оплату нет.', 105, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-08', 'fines', 'Что грозит за управление автомобилем в состоянии опьянения?', null, '["Штраф 80 000 сом и лишение прав на 2 года","Штраф 15 000 сом","Лишение прав на 6 месяцев без штрафа","Штраф 20 000 сом со скидкой"]'::jsonb, 0, 'Вождение в состоянии опьянения — 80 000 сом и лишение права управления на 2 года (ст. 193 КоП). Скидки нет.', 106, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-09', 'fines', 'Что грозит за отказ от медицинского освидетельствования на опьянение?', null, '["Штраф 100 000 сом и лишение прав на 3 года","Ничего — это право водителя","Штраф 5 500 сом","Штраф 80 000 сом и лишение прав на 2 года"]'::jsonb, 0, 'Отказ от освидетельствования наказывается строже, чем само опьянение: 100 000 сом и лишение прав на 3 года (ст. 193 КоП).', 107, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-10', 'fines', 'Что грозит водителю, который оставил место ДТП?', null, '["Штраф 20 000 сом и лишение прав на 6 месяцев","Штраф 1 000 сом","Только предупреждение","Штраф 5 500 сом"]'::jsonb, 0, 'Оставление места ДТП — 20 000 сом и лишение права управления на 6 месяцев (ст. 192 КоП). Скидки нет.', 108, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-11', 'fines', 'Какую скидку дают за быструю оплату штрафа?', null, '["70%, если оплатить в течение 30 дней","50%, если оплатить в течение 20 дней","30%, если оплатить в течение недели","Скидок на штрафы нет"]'::jsonb, 0, 'Большинство штрафов можно оплатить со скидкой 70% в течение 30 дней со дня постановления. На тяжкие нарушения (опьянение, отказ от освидетельствования, автохулиганство, выезд на встречную, сильное превышение) скидка не распространяется.', 109, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-12', 'fines', 'Какой штраф, если не уступить дорогу машине со спецсигналами?', null, '["10 000 сом","1 000 сом","3 000 сом","20 000 сом"]'::jsonb, 0, 'Непропуск транспорта с включёнными спецсигналами — 10 000 сом (ст. 188 КоП), со скидкой — 3 000 сом.', 110, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-13', 'fines', 'Какой штраф за управление автомобилем без водительского удостоверения (права не получены)?', null, '["15 000 сом","1 000 сом","3 000 сом","80 000 сом"]'::jsonb, 0, 'Управление без права управления — 15 000 сом (ст. 184 КоП). Если права есть, но не при себе (и они есть в базе) — 1 000 сом.', 111, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-14', 'fines', 'Какой штраф для водителя-физлица за незаконную тонировку лобового и передних боковых стёкол?', null, '["20 000 сом","1 000 сом","5 500 сом","40 000 сом"]'::jsonb, 0, 'Незаконная тонировка — 20 000 сом для физических лиц и 40 000 сом для юридических; со скидкой — 6 000 и 12 000 сом.', 112, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
insert into public.pdd_questions (id, topic_key, question, sign, options, answer, explain, ord, is_active)
values ('fines-15', 'fines', 'Какой штраф за управление автомобилем без полиса ОСАГО (для физлица)?', null, '["3 000 сом","13 000 сом","1 000 сом","Штрафа нет"]'::jsonb, 0, 'Отсутствие полиса ОСАГО — 3 000 сом для физических лиц и 13 000 сом для юридических (ст. 184 КоП), со скидкой — 900 и 3 900 сом.', 113, true)
on conflict (id) do update set
  topic_key = excluded.topic_key, question = excluded.question, sign = excluded.sign, options = excluded.options,
  answer = excluded.answer, explain = excluded.explain, ord = excluded.ord, is_active = true;
update public.pdd_questions set is_active = false where not (id = any(array['priority-01', 'priority-02', 'priority-03', 'priority-04', 'priority-05', 'priority-06', 'priority-07', 'priority-08', 'priority-09', 'priority-10', 'prohibit-01', 'prohibit-02', 'prohibit-03', 'prohibit-04', 'prohibit-05', 'prohibit-06', 'prohibit-07', 'prohibit-08', 'prohibit-09', 'prohibit-10', 'prohibit-11', 'signs-01', 'signs-02', 'signs-03', 'signs-04', 'signs-05', 'signs-06', 'signs-07', 'signs-08', 'signs-09', 'signs-10', 'lights-01', 'lights-02', 'lights-03', 'lights-04', 'lights-05', 'lights-06', 'lights-07', 'lights-08', 'lights-09', 'lights-10', 'intersections-01', 'intersections-02', 'intersections-03', 'intersections-04', 'intersections-05', 'intersections-06', 'intersections-07', 'intersections-08', 'intersections-09', 'intersections-10', 'intersections-11', 'maneuvers-01', 'maneuvers-02', 'maneuvers-03', 'maneuvers-04', 'maneuvers-05', 'maneuvers-06', 'maneuvers-07', 'maneuvers-08', 'maneuvers-09', 'maneuvers-10', 'maneuvers-11', 'speed-01', 'speed-02', 'speed-03', 'speed-04', 'speed-05', 'speed-06', 'speed-07', 'speed-08', 'speed-09', 'speed-10', 'speed-11', 'speed-12', 'stopping-01', 'stopping-02', 'stopping-03', 'stopping-04', 'stopping-05', 'stopping-06', 'stopping-07', 'stopping-08', 'stopping-09', 'stopping-10', 'stopping-11', 'stopping-12', 'pedestrians-01', 'pedestrians-02', 'pedestrians-03', 'pedestrians-04', 'pedestrians-05', 'pedestrians-06', 'pedestrians-07', 'pedestrians-08', 'pedestrians-09', 'pedestrians-10', 'pedestrians-11', 'fines-01', 'fines-02', 'fines-03', 'fines-04', 'fines-05', 'fines-06', 'fines-07', 'fines-08', 'fines-09', 'fines-10', 'fines-11', 'fines-12', 'fines-13', 'fines-14', 'fines-15']::text[]));

commit;
