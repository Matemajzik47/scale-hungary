-- Landing: a "Album" szám csak a tényleges albumokat (és EP-ket) számolja, az önálló számokat nem.
-- Az önálló számok is "albumként" vannak tárolva (1 dalos kiadás), ezért a dalok számából döntünk:
-- legalább p_min_tracks dalos kiadás számít albumnak (a Spotify is legfeljebb 3 dalt hív kislemeznek).
create or replace function album_count(p_min_tracks int default 4)
returns bigint
language sql
stable
as $$
  select count(*)
  from (
    select album_id
    from tracks
    group by album_id
    having count(*) >= p_min_tracks
  ) t
$$;

grant execute on function album_count(int) to anon, authenticated;
