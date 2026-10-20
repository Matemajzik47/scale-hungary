-- Követések, gyorsító indexek (ízlés-egyezés, daloldali trend) és a Spotify-pótlás oszlopa.
-- Futtasd a Supabase Dashboard → SQL Editor → New query → illeszd be → Run

create table if not exists follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on follows (following_id);

alter table follows enable row level security;

-- A követések számát és listáját mindenki láthatja (publikus profil-adat)
create policy "Követések olvashatók" on follows
  for select using (true);

-- Csak a saját nevedben követhetsz valakit
create policy "Saját követés létrehozása" on follows
  for insert with check (auth.uid() = follower_id);

-- Csak a saját követésedet szüntetheted meg
create policy "Saját követés törlése" on follows
  for delete using (auth.uid() = follower_id);

-- A daloldali 7 napos trendhez és az ízlés-egyezéshez
create index if not exists ratings_track_created_idx on ratings (track_id, created_at);
create index if not exists ratings_user_idx on ratings (user_id);

-- Spotify-párosítás pótlásához: mikor próbáltuk utoljára összepárosítani az albumot
alter table albums add column if not exists spotify_checked_at timestamp with time zone;
