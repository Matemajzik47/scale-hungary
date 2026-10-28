-- Push értesítések (reggeli "új megjelenések" üzenet)

-- 1) Mikor került be az album a katalógusba? (az "új" megjelenés ebből állapítható meg,
--    mert a MusicBrainz napokat késhet, a megjelenési dátum ezért nem elég)
alter table albums add column if not exists created_at timestamptz;
-- a meglévő albumok ne számítsanak újnak
update albums set created_at = coalesce(release_date::timestamptz, now()) where created_at is null;
alter table albums alter column created_at set default now();
create index if not exists albums_created_at_idx on albums (created_at desc);

-- 2) Feliratkozások: egy böngésző/eszköz = egy sor
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_sent_at timestamptz
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Csak a szerver (service role) éri el: nincs szabály, így a nyilvános kulccsal semmi sem olvasható
alter table push_subscriptions enable row level security;
