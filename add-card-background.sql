-- Taste ID kártya háttérkép: oszlop a profilhoz + nyilvános tároló (bucket)
alter table profiles add column if not exists card_bg_url text;

insert into storage.buckets (id, name, public)
values ('card-backgrounds', 'card-backgrounds', true)
on conflict (id) do nothing;

-- Mindenki láthatja (a profilokat más is nézi), de csak a saját mappádba tölthetsz fel
drop policy if exists "Kartya hatter olvasas" on storage.objects;
create policy "Kartya hatter olvasas" on storage.objects
  for select using (bucket_id = 'card-backgrounds');

drop policy if exists "Kartya hatter feltoltes" on storage.objects;
create policy "Kartya hatter feltoltes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Kartya hatter csere" on storage.objects;
create policy "Kartya hatter csere" on storage.objects
  for update to authenticated
  using (bucket_id = 'card-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Kartya hatter torles" on storage.objects;
create policy "Kartya hatter torles" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);
