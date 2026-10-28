-- Felfedezés: a következő adag dal összeállítása a szerveren
--
-- A sor több rétegből áll (20 dalos adagnál):
--   friss    (10)  az elmúlt 14 nap megjelenései, legújabb elöl
--   közelmúlt (5)  az elmúlt 14–90 nap kiadásai, véletlen sorrendben
--   régebbi   (3)  90 napnál régebbi dalok, a legkevesebb értékeléssel (rejtett gyöngyszemek)
--   meglepetés (2) véletlen dal bárhonnan
-- Ha egy réteg kevés, a hiányzó helyeket a meglepetés-réteg tölti ki. A rétegek arányosan keverednek.
--
-- Egy adagban egy albumról legfeljebb 2, egy előadótól legfeljebb 3 dal szerepel, így egy hosszú album
-- nem tölti meg a sort; a többi dala a következő adagokban jön (a kliens a már látottakat kizárja).
-- A véletlen sorrend a p_seed értékből adódik (felhasználónként és naponként más), de azonos seednél azonos.
-- Kizárva: a bejelentkezett felhasználó már értékelt dalai és a p_exclude lista.
-- Taste-alapú réteg később jön; addig a helyét a többi réteg veszi át.

create or replace function discover_deck(
  p_limit int default 20,
  p_exclude uuid[] default '{}',
  p_seed text default ''
)
returns table (
  track_id uuid,
  title text,
  spotify_track_id text,
  album_id uuid,
  album_title text,
  cover_url text,
  spotify_album_id text,
  release_date date,
  artist_id uuid,
  artist_name text,
  community_avg numeric,
  total_ratings bigint,
  layer text
)
language sql
stable
as $$
  with params as (
    select greatest(p_limit, 1) as n,
           ceil(greatest(p_limit, 1) * 0.50)::int as qf,
           ceil(greatest(p_limit, 1) * 0.25)::int as qr,
           ceil(greatest(p_limit, 1) * 0.15)::int as qo
  ),
  base as (
    select t.id as track_id, t.title, t.spotify_track_id,
           a.id as album_id, a.title as album_title, a.cover_url, a.spotify_album_id, a.release_date,
           ar.id as artist_id, ar.name as artist_name
    from tracks t
    join albums a on a.id = t.album_id
    join artists ar on ar.id = a.artist_id
    where a.release_date is not null
      and a.release_date <= current_date
      and not (t.id = any(p_exclude))
      and not exists (
        select 1 from ratings r where r.track_id = t.id and r.user_id = auth.uid()
      )
  ),
  cnt as (
    select r.track_id, count(*) as n, avg(r.score) as avg_score
    from ratings r
    where r.track_id in (select track_id from base)
    group by r.track_id
  ),
  scored as (
    select b.*,
           coalesce(c.n, 0) as n_ratings,
           c.avg_score,
           case when b.release_date >= current_date - 14 then 'fresh'
                when b.release_date >= current_date - 90 then 'recent'
                else 'old' end as lyr,
           row_number() over (partition by b.album_id order by md5(p_seed || b.track_id::text)) as album_rank,
           row_number() over (partition by b.artist_id order by md5(p_seed || 'a' || b.track_id::text)) as artist_rank
    from base b
    left join cnt c on c.track_id = b.track_id
  ),
  capped as (
    select * from scored where album_rank <= 2 and artist_rank <= 3
  ),
  layered as (
    select c.*,
           case c.lyr
             when 'fresh' then row_number() over (partition by c.lyr order by c.release_date desc, md5(p_seed || c.track_id::text))
             when 'recent' then row_number() over (partition by c.lyr order by md5(p_seed || 'r' || c.track_id::text))
             else row_number() over (partition by c.lyr order by c.n_ratings asc, md5(p_seed || 'o' || c.track_id::text))
           end as pos
    from capped c
  ),
  primary_picks as (
    select l.*, 
           (l.pos - 0.5) / (case l.lyr when 'fresh' then p.qf when 'recent' then p.qr else p.qo end) as slot
    from layered l, params p
    where (l.lyr = 'fresh' and l.pos <= p.qf)
       or (l.lyr = 'recent' and l.pos <= p.qr)
       or (l.lyr = 'old' and l.pos <= p.qo)
  ),
  wild_pool as (
    select l.*,
           row_number() over (order by md5(p_seed || 'w' || l.track_id::text)) as wpos
    from layered l
    where not exists (select 1 from primary_picks pp where pp.track_id = l.track_id)
  ),
  wild_picks as (
    select w.*,
           (w.wpos - 0.5) / greatest(p.n - (select count(*) from primary_picks), 1) as slot
    from wild_pool w, params p
    where w.wpos <= greatest(p.n - (select count(*) from primary_picks), 0)
  ),
  picked as (
    select track_id, title, spotify_track_id, album_id, album_title, cover_url, spotify_album_id, release_date,
           artist_id, artist_name, avg_score, n_ratings, lyr, slot from primary_picks
    union all
    select track_id, title, spotify_track_id, album_id, album_title, cover_url, spotify_album_id, release_date,
           artist_id, artist_name, avg_score, n_ratings, 'wild' as lyr, slot from wild_picks
  )
  select pk.track_id, pk.title, pk.spotify_track_id, pk.album_id, pk.album_title, pk.cover_url,
         pk.spotify_album_id, pk.release_date, pk.artist_id, pk.artist_name,
         pk.avg_score::numeric, pk.n_ratings::bigint, pk.lyr
  from picked pk
  order by pk.slot, md5(p_seed || 'k' || pk.track_id::text)
  limit (select n from params)
$$;

grant execute on function discover_deck(int, uuid[], text) to anon, authenticated;
