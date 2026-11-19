-- Wish numbers without holes: a new wish takes the number after the highest one.
-- The built-in counter used a number on every failed try (an @ that already wished) and never went back,
-- so testing "delete, fix, send again" climbed to #26 with one wish left. Now the newest wish, deleted
-- and sent again, gets its number back. A gap appears only if an older wish is deleted while newer ones
-- stay: the others keep their numbers, so cards already shared on X and Telegram stay right.
-- Applied by hand (supabase db query --linked -f this file): the remote migration history has other
-- timestamps, so `supabase db push` would re-run the old files.

create or replace function public.make_wish(
  p_name text, p_wish text, p_cost integer, p_platform text, p_handle text, p_lang text default 'en'
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := private.clean_text(p_name);
  v_wish   text := private.clean_text(p_wish);
  v_handle text := ltrim(btrim(coalesce(p_handle, '')), '@');
  v_key    text := replace(gen_random_uuid()::text, '-', '');  -- 122 random bits
  v_hash   text;
  v_id     bigint;
begin
  perform private.check_wish(v_name, v_wish, p_cost, p_platform, v_handle);

  -- At most 5 wishes per hour from one connection, deleted ones included. No address → no wish.
  v_hash := private.visitor_hash();
  perform private.take_turn(v_hash, 5);

  -- one wish is numbered at a time, so two people wishing at once never get the same number
  perform pg_advisory_xact_lock(hashtext('genie:wish-number'));
  select coalesce(max(w.id), 0) + 1 into v_id from public.wishes w;

  insert into public.wishes (id, name, wish, cost_usd, platform, handle, lang, ip_hash, is_public, edit_hash)
  overriding system value
  values (v_id, v_name, v_wish, p_cost, p_platform, v_handle,
          case when p_lang = 'ar' then 'ar' else 'en' end, v_hash, true, private.key_hash(v_key));

  -- keep the built-in counter level, so a wish added by hand in SQL never takes a used number
  perform setval(pg_get_serial_sequence('public.wishes', 'id'), v_id);
  return json_build_object('id', v_id, 'key', v_key);
exception
  when unique_violation then raise exception 'already_wished';
end;
$$;

revoke all on function public.make_wish(text, text, integer, text, text, text) from public;
grant execute on function public.make_wish(text, text, integer, text, text, text) to anon, authenticated;
