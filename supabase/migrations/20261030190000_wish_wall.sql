-- The Wish Wall: a wish is public unless the wisher keeps it private,
-- with ❤ "I hope it comes true" and a link per wish (wishes.html#w37).
-- Visitors still only call functions: make_wish(), wish_stats(), wish_wall(), heart_wish().
-- Keep in sync with assets/onewish/api.js (WALL_PAGE = 12) and wall.js.

-- Wishes made before the Wall existed never agreed to be shown, so they start private.
alter table public.wishes
  add column is_public  boolean not null default false,
  add column hearts     integer not null default 0 check (hearts >= 0),
  add column tx_url     text,        -- the transfer stays on the wish, so the Wall can show it forever
  add column granted_at timestamptz;

create index wishes_wall_new on public.wishes (id desc) where is_public and status <> 'hidden';
create index wishes_wall_loved on public.wishes (hearts desc, id desc) where is_public and status in ('new', 'picked');

-- The Lamp only holds the current transfer — copy it onto a wish already granted.
update public.wishes w set tx_url = l.tx_url, granted_at = l.updated_at
from public.lamp l
where l.wish_id = w.id and w.status = 'granted' and l.tx_url is not null;

-- One ❤ per wish per connection.
create table public.hearts (
  wish_id    bigint not null references public.wishes (id) on delete cascade,
  ip_hash    text not null,
  created_at timestamptz not null default now(),
  primary key (wish_id, ip_hash)
);
create index hearts_ip_recent on public.hearts (ip_hash, created_at);
alter table public.hearts enable row level security;
revoke all on public.hearts from anon, authenticated;

-- ── Internal helpers (schema "private" is not reachable from the website) ──
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- sha256 of the visitor's address, or null when there is none.
create function private.visitor_hash() returns text
language plpgsql stable set search_path = ''
as $$
declare
  v_headers json := coalesce(current_setting('request.headers', true), '{}')::json;
  -- The visitor can write anything at the START of X-Forwarded-For; the proxy appends
  -- the real address at the END. cf-connecting-ip is set by Cloudflare itself.
  v_ip text := coalesce(nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
                 btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', -1)));
begin
  if v_ip = '' then return null; end if;
  return encode(sha256(convert_to('genie-wish:' || v_ip, 'UTF8')), 'hex');
end;
$$;

-- One wish as the Wall shows it. Never the ip_hash; cost and money only once the Genie picked it.
create function private.wish_card(p_w public.wishes) returns json
language sql stable set search_path = ''
as $$
  select json_build_object(
    'id', (p_w).id, 'name', (p_w).name, 'wish', (p_w).wish,
    'platform', (p_w).platform, 'handle', (p_w).handle,
    'created_at', (p_w).created_at, 'status', (p_w).status, 'hearts', (p_w).hearts,
    'cost',   case when (p_w).status in ('picked', 'granted') then (p_w).cost_usd end,
    'raised', case when (p_w).status = 'picked'
                   then (select l.raised_usd from public.lamp l where l.wish_id = (p_w).id) end,
    'tx_url', case when (p_w).status = 'granted' then (p_w).tx_url end);
$$;

revoke all on function private.visitor_hash(), private.wish_card(public.wishes) from public, anon, authenticated;

-- ── Public: make a wish (now with the private choice) ──────────────────
-- p_public defaults to false: a page that never asked (the old form) never publishes anyone.
drop function public.make_wish(text, text, integer, text, text, text);
create function public.make_wish(
  p_name text, p_wish text, p_cost integer, p_platform text, p_handle text,
  p_lang text default 'en', p_public boolean default false
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name   text := btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'),
                     '[[:cntrl:]​‪-‮⁦-⁩]', '', 'g'));
  v_wish   text := btrim(regexp_replace(regexp_replace(coalesce(p_wish, ''), '\s+', ' ', 'g'),
                     '[[:cntrl:]​‪-‮⁦-⁩]', '', 'g'));
  v_handle text := ltrim(btrim(coalesce(p_handle, '')), '@');
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
  v_hash := private.visitor_hash();
  if v_hash is null then raise exception 'rate_limited'; end if;
  -- Lock per address so 50 parallel requests can't all pass the count at once.
  perform pg_advisory_xact_lock(hashtext(v_hash));
  if (select count(*) from public.wishes
      where ip_hash = v_hash and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.wishes (name, wish, cost_usd, platform, handle, lang, ip_hash, is_public)
  values (v_name, v_wish, p_cost, p_platform, v_handle,
          case when p_lang = 'ar' then 'ar' else 'en' end, v_hash, coalesce(p_public, false))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then raise exception 'already_wished';
end;
$$;

-- ── Public: counters + current wish for the opening scene ──────────────
-- A private wish can still be picked: the Lamp then fills for "wish #n", without its words or name.
create or replace function public.wish_stats()
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
        'id', w.id, 'private', not w.is_public,
        'name', case when w.is_public then w.name end,
        'wish', case when w.is_public then w.wish end,
        'cost', w.cost_usd, 'raised', l.raised_usd, 'granted', w.status = 'granted',
        'tx_url', case when w.status = 'granted' then coalesce(w.tx_url, l.tx_url) end)
      from public.lamp l
      join public.wishes w on w.id = l.wish_id
      where w.status in ('picked', 'granted')
    )
  );
$$;

-- ── Public: one page of the Wall (12 cards), or the one wish a shared link points at ──
-- p_sort: 'new' (newest first) | 'loved' (most ❤, still waiting) | 'true' (came true)
create function public.wish_wall(p_sort text default 'new', p_offset integer default 0, p_id bigint default null)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sort   text := case when p_sort in ('new', 'loved', 'true') then p_sort else 'new' end;
  v_offset integer := case when p_id is null then greatest(0, least(coalesce(p_offset, 0), 100000)) else 0 end;
  v_items  json;
  v_more   boolean;
begin
  select coalesce(json_agg(private.wish_card(p.w) order by p.rn) filter (where p.rn <= v_offset + 12), '[]'::json),
         coalesce(max(p.rn) > v_offset + 12, false)
    into v_items, v_more
  from (
    select w, row_number() over (
             order by case when p_id is null and v_sort = 'loved' then w.hearts end desc nulls last, w.id desc) as rn
    from public.wishes w
    where w.is_public and w.status <> 'hidden'
      and case when p_id is not null then w.id = p_id
               when v_sort = 'true'  then w.status = 'granted'
               when v_sort = 'loved' then w.status <> 'granted'
               else true end
  ) p
  where p.rn > v_offset and p.rn <= v_offset + 13;

  return json_build_object(
    'made',    (select count(*) from public.wishes where status <> 'hidden'),
    'granted', (select count(*) from public.wishes where status = 'granted'),
    'current', (select private.wish_card(w)
                from public.lamp l join public.wishes w on w.id = l.wish_id
                where w.status in ('picked', 'granted') and w.is_public),
    'items',   v_items,
    'more',    v_more
  );
end;
$$;

-- ── Public: ❤ "I hope it comes true" — once per wish per connection ────
create function public.heart_wish(p_id bigint) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := private.visitor_hash();
  v_n    integer;
begin
  if not exists (select 1 from public.wishes
                 where id = p_id and is_public and status in ('new', 'picked')) then
    raise exception 'invalid_wish';
  end if;
  if v_hash is null then raise exception 'rate_limited'; end if;
  perform pg_advisory_xact_lock(hashtext('heart:' || v_hash));
  -- a person ❤s a handful of wishes, a script thousands: 60 an hour per connection
  if (select count(*) from public.hearts
      where ip_hash = v_hash and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limited';
  end if;
  insert into public.hearts (wish_id, ip_hash) values (p_id, v_hash) on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    update public.wishes set hearts = hearts + 1 where id = p_id returning hearts into v_n;
  else
    select hearts into v_n from public.wishes where id = p_id;
  end if;
  return v_n;
end;
$$;

-- ── Owner: granting now also keeps the transfer link on the wish ───────
create or replace function public.genie_grant(p_tx_url text) returns text
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
  update public.wishes set status = 'granted', tx_url = p_tx_url, granted_at = now() where id = v_id;
  update public.lamp set tx_url = p_tx_url, updated_at = now();
  return 'Wish #' || v_id || ' granted';
end;
$$;

revoke all on function public.make_wish(text, text, integer, text, text, text, boolean),
  public.wish_wall(text, integer, bigint), public.heart_wish(bigint) from public;
grant execute on function public.make_wish(text, text, integer, text, text, text, boolean),
  public.wish_wall(text, integer, bigint), public.heart_wish(bigint) to anon, authenticated;
revoke all on function public.genie_grant(text) from public, anon, authenticated;
