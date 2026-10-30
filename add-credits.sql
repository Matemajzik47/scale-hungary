-- Vendég-közreműködések (feat.): egy kiadás egyszer szerepel, az elsődleges előadónál (albums.artist_id),
-- a vendég előadók pedig ebben a táblában kapcsolódnak hozzá. Az értékelés így közös marad.
create table if not exists album_artists (
  album_id uuid not null references albums(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  role text not null default 'featured' check (role in ('featured')),
  primary key (album_id, artist_id)
);

create index if not exists album_artists_artist_idx on album_artists (artist_id);

alter table album_artists enable row level security;

-- Olvasni mindenki tud (az előadó oldalon és a keresésben látszik), írni csak a szerver (service role)
drop policy if exists "album_artists read" on album_artists;
create policy "album_artists read" on album_artists for select using (true);
grant select on album_artists to anon, authenticated;
