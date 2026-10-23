-- =========================================================
-- 003 — Catálogo de serviços da Navalha Nobre
-- Rode no SQL Editor do Supabase (uma vez; rodar de novo não causa problema).
-- 1. Esconde todos os serviços atuais
-- 2. Cria/atualiza os 19 serviços da Navalha Nobre (reaproveita os que têm o mesmo código)
-- 3. Apaga os serviços antigos que nunca foram agendados
--    (os que já têm agendamento ficam guardados, escondidos, para o histórico)
-- =========================================================

update public.servicos set ativo = false;

insert into public.servicos (slug, nome, categoria, duracao_min, preco, preco_a_partir, descricao, ordem) values
  ('corte', 'Corte de Cabelo', 'Cabelo', 30, 35.00, true, null, 1),
  ('corte-tesoura', 'Corte na Tesoura', 'Cabelo', 30, 35.00, false, null, 2),
  ('pezinho', 'Pezinho', 'Cabelo', 10, 15.00, false, null, 3),
  ('escova', 'Escova', 'Cabelo', 10, 15.00, false, null, 4),
  ('barba', 'Barba', 'Barba e sobrancelha', 15, 35.00, false, null, 5),
  ('sobrancelha', 'Sobrancelhas', 'Barba e sobrancelha', 10, 15.00, false, null, 6),
  ('hidratacao', 'Hidratação', 'Tratamentos e química', 10, 20.00, false, null, 7),
  ('botox', 'Botox', 'Tratamentos e química', 30, 60.00, true, 'Valor inicial de R$ 60,00. O valor final é definido após a avaliação do cabelo.', 8),
  ('selagem', 'Selagem Capilar', 'Tratamentos e química', 50, 60.00, true, 'Valor inicial de R$ 60,00. O valor final é definido após a avaliação do cabelo.', 9),
  ('progressiva', 'Progressiva', 'Tratamentos e química', 30, 70.00, true, 'Valor inicial de R$ 70,00. O valor final é definido após a avaliação do cabelo.', 10),
  ('luzes', 'Luzes', 'Tratamentos e química', 90, 90.00, true, null, 11),
  ('platinado', 'Platinado', 'Tratamentos e química', 180, 104.00, false, 'Promoção: de R$ 130,00 por R$ 104,00.', 12),
  ('corte-sobrancelha-hidratacao', 'Corte + Sobrancelhas + Hidratação', 'Combos', 60, 70.00, false, null, 13),
  ('corte-barba', 'Corte + Barba', 'Combos', 45, 70.00, true, null, 14),
  ('corte-barba-sobrancelha', 'Corte + Barba + Sobrancelhas', 'Combos', 55, 85.00, false, null, 15),
  ('corte-barba-hidratacao', 'Corte + Barba + Hidratação', 'Combos', 60, 90.00, false, null, 16),
  ('corte-barba-selagem', 'Corte + Barba + Selagem', 'Combos', 80, 130.00, true, null, 17),
  ('corte-barba-botox', 'Corte + Barba + Botox', 'Combos', 90, 130.00, true, null, 18),
  ('corte-barba-selagem-sobrancelha', 'Corte + Barba + Selagem + Sobrancelhas', 'Combos', 90, 145.00, true, null, 19)
on conflict (slug) do update set
  nome           = excluded.nome,
  categoria      = excluded.categoria,
  duracao_min    = excluded.duracao_min,
  preco          = excluded.preco,
  preco_a_partir = excluded.preco_a_partir,
  descricao      = excluded.descricao,
  ordem          = excluded.ordem,
  ativo          = true;

delete from public.servicos s
where not s.ativo
  and not exists (select 1 from public.agendamentos a where a.servico_id = s.id);
