-- Egy sornyi állapot-tábla, hogy a napi cron tudja, hol tartott a régi
-- (archív) magyar kiadások fokozatos feltöltésében. A "friss" (heti) sync
-- ettől függetlenül mindig lefut; ez csak a backfill pozícióját követi.
--
-- backfill_range_index: melyik dátumsávnál tartunk (0 = legújabb/elmúlt
--   ~10 év, 1 = 2000-2015, stb. — lásd BACKFILL_RANGES a kódban)
-- backfill_offset: az adott sávon belül hányadik elemtől folytassuk
create table sync_state (
  id text primary key default 'catalog_backfill',
  backfill_offset integer not null default 0,
  backfill_range_index integer not null default 0,
  backfill_done boolean not null default false,
  updated_at timestamp with time zone default now()
);

insert into sync_state (id, backfill_offset, backfill_range_index, backfill_done)
values ('catalog_backfill', 0, 0, false);

alter table sync_state enable row level security;

-- Csak a service_role (admin kliens) olvashatja/írhatja — nincs rá szükség
-- kliens-oldalról, ez tisztán szerver-oldali könyvelés.
create policy "Sync state csak service role-nak" on sync_state
  for all using (false);
