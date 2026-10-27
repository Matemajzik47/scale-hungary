-- Szerver oldali keresés: az egész katalógusban keres (ékezet- és kisbetű-független),
-- és csak a megjelenített oldalnyi találatot adja vissza.
create extension if not exists unaccent;

create or replace function search_tracks(q text default '', lim int default 30, skip int default 0)
returns table (
  track_id uuid,
  track_title text,
  spotify_track_id text,
  album_id uuid,
  album_title text,
  cover_url text,
  spotify_album_id text,
  artist_id uuid,
  artist_name text,
  release_date date
)
language sql
stable
as $$
  with s as (
    select '%' || replace(replace(replace(unaccent(lower(trim(coalesce(q, '')))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat,
           unaccent(lower(trim(coalesce(q, '')))) as raw
  )
  select t.id, t.title, t.spotify_track_id,
         a.id, a.title, a.cover_url, a.spotify_album_id,
         ar.id, ar.name, a.release_date
  from tracks t
  join albums a on a.id = t.album_id
  join artists ar on ar.id = a.artist_id
  cross join s
  where s.raw = ''
     or unaccent(lower(t.title)) like s.pat
     or unaccent(lower(ar.name)) like s.pat
     or unaccent(lower(a.title)) like s.pat
  order by
    -- előre a pontos/előtag egyezések, utána a legfrissebbek
    case
      when s.raw <> '' and (starts_with(unaccent(lower(t.title)), s.raw) or starts_with(unaccent(lower(ar.name)), s.raw)) then 0
      else 1
    end,
    a.release_date desc nulls last,
    t.id
  limit greatest(least(lim, 100), 1)
  offset greatest(skip, 0);
$$;

grant execute on function search_tracks(text, int, int) to anon, authenticated;
