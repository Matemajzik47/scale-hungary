-- Szintek, XP és kredit
-- Az XP-t NEM a böngésző számolja: a user_progress függvény a ratings táblából vezeti le,
-- így nem hamisítható. A kredit naplója (credit_ledger) csak a szerverről írható.

-- Gyorsító indexek az XP-számításhoz
create index if not exists ratings_track_created_idx on ratings (track_id, created_at);
create index if not exists ratings_user_created_idx on ratings (user_id, created_at);

-- Kredit-napló: költések (negatív) és kézi jóváírások (pozitív). Később a bolt ide ír.
create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on credit_ledger (user_id, created_at desc);

alter table credit_ledger enable row level security;
drop policy if exists "Sajat kredit naplo olvashato" on credit_ledger;
create policy "Sajat kredit naplo olvashato" on credit_ledger
  for select using (auth.uid() = user_id);
-- Írási szabály nincs: csak a service role (szerver) tud írni.

/*
  XP-szabályok (a napi nap Europe/Budapest szerint):
    + 10  új dal értékelése (a módosítás nem ad pontot, mert a created_at nem változik);
          egy napon az első 10 értékelés ér teljes XP-t, a 11–20. csak 3 XP-t, efölött nincs
    +  5  friss kiadás (a megjelenéstől számított 14 napon belül értékelve), csak a teljes XP-s értékelésekre
    +  5  a dal első 10 értékelője között voltál (kis előadó / korai felfedezés), csak a teljes XP-s értékelésekre
    + 10  napi első értékelés bónusz
    + 2/nap  széria-bónusz (legfeljebb +20)
    + 100 / 500 / 2000  a 7. / 30. / 100. egymást követő napon (egyszeri)
  A kredit egyelőre ugyanennyi (credits_earned = xp); később külön hangolható.
*/
create or replace function user_progress(p_user uuid)
returns table (
  total_ratings int,
  xp int,
  credits_earned int,
  ledger_sum int,
  max_streak int,
  early_ratings int,
  release_day_ratings int
)
language sql
stable
as $$
  with mine as (
    select r.track_id, r.created_at,
           (r.created_at at time zone 'Europe/Budapest')::date as d
    from ratings r
    where r.user_id = p_user
  ),
  ranked as (
    select m.*,
           (select count(*) from ratings x
             where x.track_id = m.track_id and x.created_at <= m.created_at) as rank_on_track,
           row_number() over (partition by m.d order by m.created_at) as n_in_day,
           a.release_date
    from mine m
    left join tracks t on t.id = m.track_id
    left join albums a on a.id = t.album_id
  ),
  per_rating as (
    select case
             when n_in_day <= 10 then
               10
               + case when release_date is not null and release_date <= d and release_date >= d - 14 then 5 else 0 end
               + case when rank_on_track <= 10 then 5 else 0 end
             when n_in_day <= 20 then 3
             else 0
           end as pts
    from ranked
  ),
  days as (select distinct d from mine),
  runs as (
    select d, d - (row_number() over (order by d))::int as grp from days
  ),
  streaks as (
    select d, row_number() over (partition by grp order by d)::int as len from runs
  ),
  xp_total as (
    select (
      coalesce((select sum(pts) from per_rating), 0)
      + coalesce((select sum(10 + least(len * 2, 20)
                             + case len when 7 then 100 when 30 then 500 when 100 then 2000 else 0 end)
                  from streaks), 0)
    )::int as v
  )
  select
    (select count(*) from mine)::int,
    xp_total.v,
    xp_total.v,
    coalesce((select sum(amount) from credit_ledger where user_id = p_user), 0)::int,
    coalesce((select max(len) from streaks), 0)::int,
    (select count(*) from ranked where rank_on_track <= 10)::int,
    (select count(*) from ranked where release_date is not null and release_date = d)::int
  from xp_total
$$;

grant execute on function user_progress(uuid) to anon, authenticated;
