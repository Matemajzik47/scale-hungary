-- Kártyakép igazítása: melyik rész látszik (x, y százalékban) és nagyítás
alter table profiles add column if not exists card_bg_x real default 50;
alter table profiles add column if not exists card_bg_y real default 50;
alter table profiles add column if not exists card_bg_zoom real default 1;
