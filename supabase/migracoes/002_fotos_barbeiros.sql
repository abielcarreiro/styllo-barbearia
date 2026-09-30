-- =========================================================
-- 002 — Fotos dos barbeiros (Supabase Storage)
-- Rode no SQL Editor do Supabase (uma vez).
-- Cria a pasta pública "barbeiros" para as fotos: qualquer pessoa
-- pode VER as fotos (elas aparecem no site), mas só o dono pode
-- enviar, trocar ou apagar.
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('barbeiros', 'barbeiros', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos barbeiros: leitura pública" on storage.objects;
drop policy if exists "fotos barbeiros: dono envia"      on storage.objects;
drop policy if exists "fotos barbeiros: dono troca"      on storage.objects;
drop policy if exists "fotos barbeiros: dono apaga"      on storage.objects;

create policy "fotos barbeiros: leitura pública" on storage.objects
  for select using (bucket_id = 'barbeiros');

create policy "fotos barbeiros: dono envia" on storage.objects
  for insert to authenticated with check (bucket_id = 'barbeiros' and public.eh_dono());

create policy "fotos barbeiros: dono troca" on storage.objects
  for update to authenticated using (bucket_id = 'barbeiros' and public.eh_dono())
  with check (bucket_id = 'barbeiros' and public.eh_dono());

create policy "fotos barbeiros: dono apaga" on storage.objects
  for delete to authenticated using (bucket_id = 'barbeiros' and public.eh_dono());
