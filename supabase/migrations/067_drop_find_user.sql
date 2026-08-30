-- "Вызвать по нику/ID" убран совсем (не просто спрятана кнопка) —
-- решили, что не нужна. find_user больше никем не вызывается
-- (ChallengePickScreen удалён, tg-api лишился action "find_user").
drop function if exists public.find_user(text);
