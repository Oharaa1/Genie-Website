-- The Genie (an AI agent) says why it picked a wish. The reason is public once the wish is picked.
alter table public.wishes add column if not exists pick_reason text
  check (pick_reason is null or char_length(pick_reason) <= 400);

create or replace function private.wish_card(p_w public.wishes) returns json
language sql stable set search_path = ''
as $$
  select json_build_object(
    'id', (p_w).id, 'name', (p_w).name, 'wish', (p_w).wish,
    'platform', (p_w).platform, 'handle', (p_w).handle,
    'created_at', (p_w).created_at, 'status', (p_w).status, 'hearts', (p_w).hearts,
    'cost',   case when (p_w).status in ('picked', 'granted') then (p_w).cost_usd end,
    'raised', case when (p_w).status = 'picked'
                   then (select l.raised_usd from public.lamp l where l.wish_id = (p_w).id) end,
    'tx_url', case when (p_w).status = 'granted' then (p_w).tx_url end,
    'reason', case when (p_w).status in ('picked', 'granted') then (p_w).pick_reason end);
$$;

revoke all on function private.wish_card(public.wishes) from public, anon, authenticated;

-- The opening scene (the Lamp) shows the reason too, but only for a public wish.
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
        'reason', case when w.is_public then w.pick_reason end,
        'cost', w.cost_usd, 'raised', l.raised_usd, 'granted', w.status = 'granted',
        'tx_url', case when w.status = 'granted' then coalesce(w.tx_url, l.tx_url) end)
      from public.lamp l
      join public.wishes w on w.id = l.wish_id
      where w.status in ('picked', 'granted')
    )
  );
$$;

-- Admin only (SQL editor): the Genie writes its reason for the picked wish.
-- select genie_reason(12, 'She asked for the smallest thing that changes the most.');
create function public.genie_reason(p_wish_id bigint, p_reason text) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  update public.wishes set pick_reason = nullif(btrim(p_reason), '')
   where id = p_wish_id and status in ('picked', 'granted');
  if not found then
    raise exception 'Wish #% is not picked or granted', p_wish_id;
  end if;
  return 'Reason saved for wish #' || p_wish_id;
end;
$$;

revoke all on function public.genie_reason(bigint, text) from public, anon, authenticated;
