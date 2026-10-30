-- One-wish page: wishes + the Lamp.
-- Visitors never touch the tables directly. They can only call two functions:
--   make_wish(...)  → saves one wish, returns its number
--   wish_stats()    → public counters + the wish the Lamp is filling for
-- The genie_* functions are for the owner only (Supabase SQL editor).
-- Limits must match assets/onewish/logic.js (LIMITS, HANDLE_RE).

create table public.wishes (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 40),
  wish       text not null check (char_length(wish) between 10 and 280),
  cost_usd   integer not null check (cost_usd between 1 and 1000000),
  platform   text not null check (platform in ('x', 'telegram')),
  handle     text not null check (handle ~ '^[A-Za-z0-9_]{1,32}$'),
  lang       text not null default 'en' check (lang in ('en', 'ar')),
  ip_hash    text,  -- sha256 of the visitor IP, only to stop spam floods
  status     text not null default 'new' check (status in ('new', 'picked', 'granted', 'hidden'))
);

-- One wish per person (per @handle on each platform).
create unique index wishes_one_per_handle on public.wishes (platform, lower(handle));
create index wishes_ip_recent on public.wishes (ip_hash, created_at);

-- The Lamp: always exactly one row.
create table public.lamp (
  id         boolean primary key default true check (id),
  wish_id    bigint references public.wishes (id),
  raised_usd numeric(12, 2) not null default 0 check (raised_usd >= 0),
  tx_url     text,
  updated_at timestamptz not null default now()
);
insert into public.lamp default values;

alter table public.wishes enable row level security;
alter table public.lamp enable row level security;
revoke all on public.wishes, public.lamp from anon, authenticated;

-- ── Public: make a wish ────────────────────────────────────────────────
create function public.make_wish(
  p_name text, p_wish text, p_cost integer, p_platform text, p_handle text, p_lang text default 'en'
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'),
                     '[[:cntrl:]\u200B\u202A-\u202E\u2066-\u2069]', '', 'g'));
  v_wish   text := btrim(regexp_replace(regexp_replace(coalesce(p_wish, ''), '\s+', ' ', 'g'),
                     '[[:cntrl:]\u200B\u202A-\u202E\u2066-\u2069]', '', 'g'));
  v_handle text := ltrim(btrim(coalesce(p_handle, '')), '@');
  v_headers json := coalesce(current_setting('request.headers', true), '{}')::json;
  -- The visitor can write anything at the START of X-Forwarded-For; the proxy appends
  -- the real address at the END. cf-connecting-ip is set by Cloudflare itself.
  v_ip     text := coalesce(nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
                     btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', -1)));
  v_hash   text;
  v_id     bigint;
begin
  if char_length(v_name) not between 1 and 40 then raise exception 'invalid_name'; end if;
  if char_length(v_wish) not between 10 and 280 then raise exception 'invalid_wish'; end if;
  if p_cost is null or p_cost not between 1 and 1000000 then raise exception 'invalid_cost'; end if;
  if p_platform = 'x' then
    if v_handle !~ '^[A-Za-z0-9_]{1,15}$' then raise exception 'invalid_handle'; end if;
  elsif p_platform = 'telegram' then
    if v_handle !~ '^[A-Za-z][A-Za-z0-9_]{3,31}$' then raise exception 'invalid_handle'; end if;
  else
    raise exception 'invalid_platform';
  end if;

  -- At most 5 wishes per hour from one connection. No address → no wish.
  if v_ip = '' then raise exception 'rate_limited'; end if;
  v_hash := encode(sha256(convert_to('genie-wish:' || v_ip, 'UTF8')), 'hex');
  -- Lock per address so 50 parallel requests can't all pass the count at once.
  perform pg_advisory_xact_lock(hashtext(v_hash));
  if (select count(*) from public.wishes
      where ip_hash = v_hash and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.wishes (name, wish, cost_usd, platform, handle, lang, ip_hash)
  values (v_name, v_wish, p_cost, p_platform, v_handle,
          case when p_lang = 'ar' then 'ar' else 'en' end, v_hash)
  returning id into v_id;
  return v_id;
exception
  when unique_violation then raise exception 'already_wished';
end;
$$;

-- ── Public: counters + current wish (never returns @handles) ───────────
create function public.wish_stats()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'made',    (select count(*) from public.wishes where status <> 'hidden'),
    'granted', (select count(*) from public.wishes where status = 'granted'),
    'current', (
      select json_build_object(
        'id', w.id, 'name', w.name, 'wish', w.wish, 'cost', w.cost_usd,
        'raised', l.raised_usd, 'granted', w.status = 'granted',
        'tx_url', case when w.status = 'granted' then l.tx_url end)
      from public.lamp l
      join public.wishes w on w.id = l.wish_id
      where w.status in ('picked', 'granted')
    )
  );
$$;

revoke all on function public.make_wish(text, text, integer, text, text, text) from public;
revoke all on function public.wish_stats() from public;
grant execute on function public.make_wish(text, text, integer, text, text, text) to anon, authenticated;
grant execute on function public.wish_stats() to anon, authenticated;

-- ── Owner only (run in the Supabase SQL editor) ────────────────────────
-- select genie_pick(7);            -- the Lamp now fills for wish #7
-- select genie_fill(1512);         -- the Lamp holds $1,512
-- select genie_grant('https://…'); -- wish granted, link to the transfer
-- select genie_hide(12);           -- remove spam wish #12 from the count

create function public.genie_pick(p_wish_id bigint) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.wishes where id = p_wish_id and status = 'new') then
    raise exception 'Wish #% does not exist or was already picked/granted/hidden', p_wish_id;
  end if;
  update public.wishes set status = 'new' where status = 'picked';
  update public.wishes set status = 'picked' where id = p_wish_id;
  update public.lamp set wish_id = p_wish_id, raised_usd = 0, tx_url = null, updated_at = now();
  return 'The Lamp now fills for wish #' || p_wish_id;
end;
$$;

create function public.genie_fill(p_raised numeric) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if p_raised is null or p_raised < 0 then raise exception 'Amount must be 0 or more'; end if;
  update public.lamp set raised_usd = p_raised, updated_at = now();
  return 'The Lamp now holds $' || p_raised;
end;
$$;

create function public.genie_grant(p_tx_url text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_tx_url is null or p_tx_url !~ '^https://' then
    raise exception 'Give the https:// link of the transfer';
  end if;
  select l.wish_id into v_id
  from public.lamp l join public.wishes w on w.id = l.wish_id
  where w.status = 'picked';
  if v_id is null then raise exception 'No picked wish to grant'; end if;
  update public.wishes set status = 'granted' where id = v_id;
  update public.lamp set tx_url = p_tx_url, updated_at = now();
  return 'Wish #' || v_id || ' granted';
end;
$$;

create function public.genie_hide(p_wish_id bigint) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  update public.wishes set status = 'hidden' where id = p_wish_id and status = 'new';
  if not found then raise exception 'Wish #% is not a new wish', p_wish_id; end if;
  return 'Wish #' || p_wish_id || ' hidden';
end;
$$;

revoke all on function public.genie_pick(bigint), public.genie_fill(numeric),
  public.genie_grant(text), public.genie_hide(bigint) from public, anon, authenticated;
