-- Every new wish is public, and the person who made it can delete it (but never change it:
-- the words people ❤ can't be swapped for something else later).
-- make_wish() now returns { id, key }. The key is a secret that only the wisher's browser has.
-- The database keeps only its sha256, like a password.
-- Visitors call: make_wish(), delete_wish() (+ wish_stats, wish_wall, heart_wish).
-- A wish can be deleted only while it waits ('new'): once the Genie picks it, it is locked.
-- Keep in sync with assets/onewish/api.js and logic.js (LIMITS, HANDLE_RE, serverErrorCode).

-- Wishes made before this have no key: nobody can delete them from the site (the owner still can, in SQL).
alter table public.wishes add column edit_hash text;

-- Every wish made per connection, for the hourly limit. The limit used to count rows in wishes,
-- so "make, delete, make again" would have reset it: this log keeps the count after a delete.
create table private.wish_log (
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index wish_log_recent on private.wish_log (ip_hash, created_at);
revoke all on private.wish_log from public, anon, authenticated;

-- ── Internal helpers ───────────────────────────────────────────────────
-- One more wish for this connection: rate_limited at the hourly limit (or with no address).
-- Runs inside the caller's transaction, so a wish that fails later (already_wished…) doesn't count.
create function private.take_turn(p_hash text, p_limit integer) returns void
language plpgsql set search_path = ''
as $$
begin
  if p_hash is null then raise exception 'rate_limited'; end if;
  -- Lock per address so 50 parallel requests can't all pass the count at once.
  perform pg_advisory_xact_lock(hashtext('make:' || p_hash));
  if (select count(*) from private.wish_log
      where ip_hash = p_hash and created_at > now() - interval '1 hour') >= p_limit then
    raise exception 'rate_limited';
  end if;
  delete from private.wish_log where ip_hash = p_hash and created_at < now() - interval '1 day';
  insert into private.wish_log (ip_hash) values (p_hash);
end;
$$;

-- Trim, flatten whitespace, drop control and bidi-override characters (as make_wish always did).
create function private.clean_text(p text) returns text
language sql immutable set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'),
               '[[:cntrl:]​‪-‮⁦-⁩]', '', 'g'));
$$;

-- The checks for a new wish. Takes values that clean_text already cleaned.
create function private.check_wish(p_name text, p_wish text, p_cost integer, p_platform text, p_handle text)
returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if char_length(p_name) not between 1 and 40 then raise exception 'invalid_name'; end if;
  if char_length(p_wish) not between 10 and 280 then raise exception 'invalid_wish'; end if;
  if p_cost is null or p_cost not between 1 and 1000000 then raise exception 'invalid_cost'; end if;
  if p_platform = 'x' then
    if p_handle !~ '^[A-Za-z0-9_]{1,15}$' then raise exception 'invalid_handle'; end if;
  elsif p_platform = 'telegram' then
    if p_handle !~ '^[A-Za-z][A-Za-z0-9_]{3,31}$' then raise exception 'invalid_handle'; end if;
  else
    raise exception 'invalid_platform';
  end if;
end;
$$;

create function private.key_hash(p_key text) returns text
language sql immutable set search_path = ''
as $$
  select encode(sha256(convert_to('genie-key:' || coalesce(p_key, ''), 'UTF8')), 'hex');
$$;

-- The status of the wish this key opens. A wrong key and a missing wish give the same error,
-- so nobody can learn anything by guessing.
create function private.key_status(p_id bigint, p_key text) returns text
language plpgsql stable set search_path = ''
as $$
declare
  v_status text;
begin
  if p_key is null or p_key !~ '^[0-9a-f]{32}$' then raise exception 'invalid_key'; end if;
  select w.status into v_status from public.wishes w
  where w.id = p_id and w.edit_hash = private.key_hash(p_key);
  if v_status is null then raise exception 'invalid_key'; end if;
  return v_status;
end;
$$;

revoke all on function private.take_turn(text, integer), private.clean_text(text),
  private.check_wish(text, text, integer, text, text), private.key_hash(text),
  private.key_status(bigint, text)
  from public, anon, authenticated;

-- ── Public: make a wish — always public now, and it comes back with its secret key ──
drop function public.make_wish(text, text, integer, text, text, text, boolean);
create function public.make_wish(
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

  insert into public.wishes (name, wish, cost_usd, platform, handle, lang, ip_hash, is_public, edit_hash)
  values (v_name, v_wish, p_cost, p_platform, v_handle,
          case when p_lang = 'ar' then 'ar' else 'en' end, v_hash, true, private.key_hash(v_key))
  returning id into v_id;
  return json_build_object('id', v_id, 'key', v_key);
exception
  when unique_violation then raise exception 'already_wished';
end;
$$;

-- ── Public: delete a wish that is still waiting (its ❤ go with it) ─────
-- A hidden wish stays: deleting it would free its @ to wish again, past the Genie.
create function public.delete_wish(p_id bigint, p_key text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.key_status(p_id, p_key) <> 'new' then raise exception 'wish_locked'; end if;
  delete from public.wishes w
  where w.id = p_id and w.status = 'new'
    and not exists (select 1 from public.lamp l where l.wish_id = w.id);
  if not found then raise exception 'wish_locked'; end if;
  return true;
end;
$$;

revoke all on function public.make_wish(text, text, integer, text, text, text),
  public.delete_wish(bigint, text) from public;
grant execute on function public.make_wish(text, text, integer, text, text, text),
  public.delete_wish(bigint, text) to anon, authenticated;
