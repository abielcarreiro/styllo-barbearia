-- =========================================================
-- STYLLO BARBEARIA — esquema do banco (Supabase / PostgreSQL)
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode ser executado uma única vez num projeto novo.
-- =========================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------
-- CONFIGURAÇÕES GERAIS (linha única)
-- ---------------------------------------------------------
create table public.configuracoes (
  id               smallint primary key default 1 check (id = 1),
  fuso             text not null default 'America/Fortaleza',
  intervalo_min    int  not null default 30 check (intervalo_min between 5 and 120),  -- espaço entre horários oferecidos
  antecedencia_min int  not null default 60 check (antecedencia_min >= 0),         -- antecedência mínima para agendar
  dias_max         int  not null default 30 check (dias_max between 1 and 365),     -- até quantos dias à frente
  chave_pix        text,
  recebedor_pix    text,
  cidade_pix       text
);
insert into public.configuracoes (id) values (1);

-- ---------------------------------------------------------
-- HORÁRIO DE FUNCIONAMENTO (0 = domingo … 6 = sábado; null = fechado)
-- ---------------------------------------------------------
create table public.horarios_funcionamento (
  dia_semana smallint primary key check (dia_semana between 0 and 6),
  abre       time,
  fecha      time,
  check ((abre is null and fecha is null) or (abre is not null and fecha is not null and abre < fecha))
);
insert into public.horarios_funcionamento (dia_semana, abre, fecha) values
  (0, null,    null),
  (1, '09:00', '19:00'),
  (2, '09:00', '19:00'),
  (3, '09:00', '19:00'),
  (4, '09:00', '19:00'),
  (5, '09:00', '19:00'),
  (6, '08:00', '18:00');

-- ---------------------------------------------------------
-- BARBEIROS
-- ---------------------------------------------------------
create table public.barbeiros (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (length(trim(nome)) between 2 and 80),
  especialidade    text,
  instagram        text,
  foto_url         text,
  comissao_percent numeric(5,2) not null default 0 check (comissao_percent between 0 and 100),
  ativo            boolean not null default true,
  ordem            int not null default 0,
  criado_em        timestamptz not null default now()
);

-- ---------------------------------------------------------
-- SERVIÇOS
-- ---------------------------------------------------------
create table public.servicos (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  nome        text not null,
  descricao   text,
  duracao_min int not null check (duracao_min between 5 and 480),
  preco       numeric(10,2) not null default 0 check (preco >= 0),
  preco_a_partir boolean not null default false,  -- exibe "A partir de R$ ..."
  categoria   text not null default 'Outros',
  ativo       boolean not null default true,
  ordem       int not null default 0,
  criado_em   timestamptz not null default now()
);
-- Catálogo inicial (gerado de supabase/servicos.json). Depois, edite pelo painel admin.
insert into public.servicos (slug, nome, categoria, duracao_min, preco, preco_a_partir, ordem) values
  ('corte', 'Corte', 'Cabelo', 30, 35.00, false, 1),
  ('pezinho', 'Pezinho', 'Cabelo', 10, 10.00, false, 2),
  ('lavar-escovar', 'Lavar e escovar', 'Cabelo', 10, 15.00, true, 3),
  ('barba', 'Barba', 'Barba', 30, 35.00, false, 4),
  ('barba-executiva', 'Barba Executiva', 'Barba', 30, 55.00, false, 5),
  ('hidratacao-barba', 'Hidratação de barba', 'Barba', 10, 15.00, false, 6),
  ('camuflagem-barba', 'Camuflagem de barba', 'Barba', 10, 20.00, false, 7),
  ('tintura-barba', 'Tintura de barba', 'Barba', 30, 20.00, true, 8),
  ('corte-barba', 'Corte + Barba', 'Combos', 60, 70.00, false, 9),
  ('corte-sobrancelha', 'Corte + Sobrancelha', 'Combos', 30, 50.00, false, 10),
  ('corte-barba-sobrancelha', 'Corte + Barba + Sobrancelha', 'Combos', 60, 85.00, false, 11),
  ('barba-pezinho', 'Barba + Pezinho', 'Combos', 30, 45.00, false, 12),
  ('barba-sobrancelha', 'Barba + Sobrancelha', 'Combos', 30, 50.00, false, 13),
  ('barba-pezinho-sobrancelha', 'Barba + Pezinho + Sobrancelha', 'Combos', 30, 60.00, false, 14),
  ('corte-hidratacao', 'Corte + Hidratação', 'Combos', 30, 60.00, true, 15),
  ('corte-sobrancelha-hidratacao', 'Corte + Sobrancelha + Hidratação', 'Combos', 30, 75.00, true, 16),
  ('corte-barba-hidratacao', 'Corte + Barba + Hidratação', 'Combos', 60, 95.00, true, 17),
  ('corte-barba-sobrancelha-hidratacao', 'Corte + Barba + Sobrancelha + Hidratação', 'Combos', 60, 110.00, true, 18),
  ('corte-botox-selagem', 'Corte + Botox ou Selagem', 'Combos', 60, 105.00, true, 19),
  ('corte-barba-selagem-botox', 'Corte + Barba + Selagem ou Botox', 'Combos', 90, 140.00, true, 20),
  ('hidratacao', 'Hidratação', 'Tratamentos capilares', 10, 25.00, true, 21),
  ('nutricao-capilar', 'Nutrição Capilar', 'Tratamentos capilares', 10, 30.00, true, 22),
  ('selagem', 'Selagem', 'Tratamentos capilares', 30, 70.00, true, 23),
  ('botox', 'Botox', 'Tratamentos capilares', 60, 70.00, true, 24),
  ('tintura-cabelo', 'Tintura de cabelo', 'Tratamentos capilares', 30, 40.00, true, 25),
  ('sobrancelha', 'Sobrancelha', 'Sobrancelha e estética', 10, 15.00, false, 26),
  ('sobrancelha-cera', 'Sobrancelha na cera', 'Sobrancelha e estética', 10, 25.00, false, 27),
  ('epilacao-nazal', 'Epilação Nazal', 'Sobrancelha e estética', 10, 15.00, false, 28),
  ('epilacao-orelha', 'Epilação Orelha', 'Sobrancelha e estética', 10, 15.00, false, 29),
  ('epilacao-nazal-orelha', 'Epilação Nazal e Orelha', 'Sobrancelha e estética', 10, 30.00, false, 30),
  ('limpeza-pele-black-mascara', 'Limpeza de pele Black Máscara', 'Sobrancelha e estética', 30, 35.00, false, 31),
  ('limpeza-pele-profunda', 'Limpeza de pele profunda', 'Sobrancelha e estética', 30, 70.00, false, 32);

-- ---------------------------------------------------------
-- PERFIS DE ACESSO AO ADMIN (1 por usuário do Supabase Auth)
-- papel: dono (tudo) | barbeiro (só a própria agenda) | pendente (sem acesso)
-- ---------------------------------------------------------
create table public.perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  nome        text,
  papel       text not null default 'pendente' check (papel in ('dono', 'barbeiro', 'pendente')),
  barbeiro_id uuid references public.barbeiros (id) on delete set null,
  criado_em   timestamptz not null default now(),
  check (papel <> 'barbeiro' or barbeiro_id is not null)
);

-- ---------------------------------------------------------
-- CLIENTES (identificados pelo telefone, só dígitos com DDD)
-- ---------------------------------------------------------
create table public.clientes (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  telefone  text not null unique check (telefone ~ '^[0-9]{10,11}$'),
  email     text,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------
-- PLANOS E ASSINATURAS
-- ---------------------------------------------------------
create table public.planos (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  descricao          text,
  preco_mensal       numeric(10,2) not null default 0 check (preco_mensal >= 0),
  itens              text[] not null default '{}',   -- o que está incluso (lista exibida no site)
  regras             text,
  servicos_incluidos uuid[] not null default '{}',   -- serviços cobertos pelo plano
  usos_mes           int check (usos_mes is null or usos_mes > 0),  -- null = ilimitado
  destaque           boolean not null default false,
  ativo              boolean not null default true,
  ordem              int not null default 0,
  criado_em          timestamptz not null default now()
);

create table public.assinaturas (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid not null references public.clientes (id) on delete restrict,
  plano_id           uuid not null references public.planos (id) on delete restrict,
  forma_pagamento    text not null check (forma_pagamento in ('pix_mensal', 'automatico')),
  status             text not null default 'pendente' check (status in ('pendente', 'ativa', 'atrasada', 'cancelada')),
  inicio             date not null default current_date,
  proximo_vencimento date,
  gateway            text,   -- ex.: mercadopago, asaas (cobrança automática)
  gateway_id         text,
  observacoes        text,
  criado_em          timestamptz not null default now()
);

-- ---------------------------------------------------------
-- AGENDAMENTOS
-- A restrição "sem_conflito" impede dois agendamentos ativos
-- sobrepostos para o mesmo barbeiro, mesmo com cliques simultâneos.
-- ---------------------------------------------------------
create table public.agendamentos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.clientes (id) on delete restrict,
  barbeiro_id   uuid not null references public.barbeiros (id) on delete restrict,
  servico_id    uuid not null references public.servicos (id) on delete restrict,
  assinatura_id uuid references public.assinaturas (id) on delete set null,
  inicio        timestamptz not null,
  fim           timestamptz not null,
  status        text not null default 'agendado'
                check (status in ('agendado', 'confirmado', 'concluido', 'cancelado', 'faltou')),
  preco         numeric(10,2) not null default 0,  -- preço no momento do agendamento
  observacoes   text,
  origem        text not null default 'site' check (origem in ('site', 'admin')),
  token         uuid not null unique default gen_random_uuid(),  -- link de consulta/cancelamento do cliente
  criado_em     timestamptz not null default now(),
  check (fim > inicio),
  constraint agendamentos_sem_conflito exclude using gist (
    barbeiro_id with =,
    tstzrange(inicio, fim, '[)') with &&
  ) where (status in ('agendado', 'confirmado', 'concluido'))
);
create index agendamentos_inicio_idx on public.agendamentos (inicio);
create index agendamentos_cliente_idx on public.agendamentos (cliente_id);

-- Folgas, feriados, almoço etc. barbeiro_id nulo = vale para todos.
create table public.bloqueios (
  id          uuid primary key default gen_random_uuid(),
  barbeiro_id uuid references public.barbeiros (id) on delete cascade,
  inicio      timestamptz not null,
  fim         timestamptz not null,
  motivo      text,
  criado_em   timestamptz not null default now(),
  check (fim > inicio)
);

-- ---------------------------------------------------------
-- FINANCEIRO (entradas e saídas)
-- ---------------------------------------------------------
create table public.lancamentos (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('entrada', 'saida')),
  categoria       text not null,  -- atendimento, assinatura, produto, aluguel, salario, outros...
  descricao       text,
  valor           numeric(10,2) not null check (valor > 0),
  forma_pagamento text check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito', 'assinatura', 'outro')),
  data            date not null default ((now() at time zone 'America/Fortaleza')::date),
  agendamento_id  uuid references public.agendamentos (id) on delete set null,
  assinatura_id   uuid references public.assinaturas (id) on delete set null,
  barbeiro_id     uuid references public.barbeiros (id) on delete set null,
  criado_por      uuid default auth.uid(),
  criado_em       timestamptz not null default now()
);
create index lancamentos_data_idx on public.lancamentos (data);

-- =========================================================
-- FUNÇÕES DE PERMISSÃO
-- =========================================================
create or replace function public.papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.perfis where id = auth.uid()
$$;

create or replace function public.eh_dono() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_atual() = 'dono', false)
$$;

create or replace function public.eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.papel_atual() in ('dono', 'barbeiro'), false)
$$;

create or replace function public.meu_barbeiro_id() returns uuid
language sql stable security definer set search_path = public as $$
  select barbeiro_id from public.perfis where id = auth.uid() and papel = 'barbeiro'
$$;

-- Todo usuário criado no Supabase Auth ganha um perfil "pendente".
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.novo_usuario();

-- =========================================================
-- SEGURANÇA (Row Level Security)
-- Visitantes do site (anon) só leem o catálogo público.
-- Agendar/consultar/cancelar é feito pelas funções RPC abaixo.
-- =========================================================
alter table public.configuracoes          enable row level security;
alter table public.horarios_funcionamento enable row level security;
alter table public.barbeiros              enable row level security;
alter table public.servicos               enable row level security;
alter table public.perfis                 enable row level security;
alter table public.clientes               enable row level security;
alter table public.planos                 enable row level security;
alter table public.assinaturas            enable row level security;
alter table public.agendamentos           enable row level security;
alter table public.bloqueios              enable row level security;
alter table public.lancamentos            enable row level security;

-- Catálogo público
create policy "config: leitura pública"   on public.configuracoes for select using (true);
create policy "config: dono altera"       on public.configuracoes for update to authenticated using (public.eh_dono()) with check (public.eh_dono());

create policy "horarios: leitura pública" on public.horarios_funcionamento for select using (true);
create policy "horarios: dono altera"     on public.horarios_funcionamento for all to authenticated using (public.eh_dono()) with check (public.eh_dono());

create policy "barbeiros: ativos públicos" on public.barbeiros for select to anon using (ativo);
create policy "barbeiros: equipe vê todos" on public.barbeiros for select to authenticated using (ativo or public.eh_equipe());
create policy "barbeiros: dono gerencia"   on public.barbeiros for all to authenticated using (public.eh_dono()) with check (public.eh_dono());
-- A comissão não aparece para visitantes:
revoke select on public.barbeiros from anon;
grant select (id, nome, especialidade, instagram, foto_url, ativo, ordem) on public.barbeiros to anon;

create policy "servicos: ativos públicos" on public.servicos for select to anon using (ativo);
create policy "servicos: equipe vê todos" on public.servicos for select to authenticated using (ativo or public.eh_equipe());
create policy "servicos: dono gerencia"   on public.servicos for all to authenticated using (public.eh_dono()) with check (public.eh_dono());

create policy "planos: ativos públicos" on public.planos for select to anon using (ativo);
create policy "planos: equipe vê todos" on public.planos for select to authenticated using (ativo or public.eh_equipe());
create policy "planos: dono gerencia"   on public.planos for all to authenticated using (public.eh_dono()) with check (public.eh_dono());

-- Perfis: cada um vê o seu; só o dono altera (ninguém se promove sozinho)
create policy "perfis: ver o próprio ou dono vê todos" on public.perfis for select to authenticated using (id = auth.uid() or public.eh_dono());
create policy "perfis: dono altera"                    on public.perfis for update to authenticated using (public.eh_dono()) with check (public.eh_dono());

-- Clientes: equipe consulta e cadastra; dono apaga
create policy "clientes: equipe lê"      on public.clientes for select to authenticated using (public.eh_equipe());
create policy "clientes: equipe cadastra" on public.clientes for insert to authenticated with check (public.eh_equipe());
create policy "clientes: equipe edita"   on public.clientes for update to authenticated using (public.eh_equipe()) with check (public.eh_equipe());
create policy "clientes: dono apaga"     on public.clientes for delete to authenticated using (public.eh_dono());

-- Agendamentos: dono vê tudo; barbeiro só os seus
create policy "agendamentos: ler"    on public.agendamentos for select to authenticated
  using (public.eh_dono() or barbeiro_id = public.meu_barbeiro_id());
-- Barbeiros criam e alteram agendamentos só pelas funções do painel (que validam tudo)
create policy "agendamentos: dono cria"  on public.agendamentos for insert to authenticated with check (public.eh_dono());
create policy "agendamentos: dono edita" on public.agendamentos for update to authenticated using (public.eh_dono()) with check (public.eh_dono());
create policy "agendamentos: apagar" on public.agendamentos for delete to authenticated using (public.eh_dono());

-- Bloqueios: equipe vê; dono gerencia todos; barbeiro gerencia os próprios
create policy "bloqueios: equipe lê"  on public.bloqueios for select to authenticated using (public.eh_equipe());
create policy "bloqueios: gerenciar"  on public.bloqueios for all to authenticated
  using (public.eh_dono() or (barbeiro_id is not null and barbeiro_id = public.meu_barbeiro_id()))
  with check (public.eh_dono() or (barbeiro_id is not null and barbeiro_id = public.meu_barbeiro_id()));

-- Assinaturas: dono gerencia; barbeiro consulta (para saber se o cliente é assinante)
create policy "assinaturas: equipe lê"    on public.assinaturas for select to authenticated using (public.eh_equipe());
create policy "assinaturas: dono gerencia" on public.assinaturas for all to authenticated using (public.eh_dono()) with check (public.eh_dono());

-- Financeiro: dono tudo; barbeiro vê e lança apenas entradas dos próprios atendimentos
create policy "lancamentos: ler" on public.lancamentos for select to authenticated
  using (public.eh_dono() or barbeiro_id = public.meu_barbeiro_id());
create policy "lancamentos: barbeiro lança atendimento" on public.lancamentos for insert to authenticated
  with check (
    public.eh_dono()
    or (tipo = 'entrada' and categoria = 'atendimento' and barbeiro_id = public.meu_barbeiro_id())
  );
create policy "lancamentos: dono edita" on public.lancamentos for update to authenticated using (public.eh_dono()) with check (public.eh_dono());
create policy "lancamentos: dono apaga" on public.lancamentos for delete to authenticated using (public.eh_dono());

-- =========================================================
-- AGENDAMENTO ONLINE (funções chamadas pelo site)
-- =========================================================

-- Barbeiro está livre no intervalo? (uso interno)
create or replace function public.barbeiro_livre(p_barbeiro uuid, p_inicio timestamptz, p_fim timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
      select 1 from public.agendamentos a
      where a.barbeiro_id = p_barbeiro
        and a.status in ('agendado', 'confirmado', 'concluido')
        and tstzrange(a.inicio, a.fim, '[)') && tstzrange(p_inicio, p_fim, '[)')
    )
    and not exists (
      select 1 from public.bloqueios k
      where (k.barbeiro_id is null or k.barbeiro_id = p_barbeiro)
        and tstzrange(k.inicio, k.fim, '[)') && tstzrange(p_inicio, p_fim, '[)')
    )
$$;

-- Horários livres de um dia para um serviço (e opcionalmente um barbeiro).
-- Retorna 'HH:MM' no fuso da barbearia.
create or replace function public.horarios_livres(p_servico uuid, p_data date, p_barbeiro uuid default null)
returns table (horario text)
language plpgsql stable security definer set search_path = public as $$
declare
  cfg       public.configuracoes;
  hf        public.horarios_funcionamento;
  dur       int;
  hoje      date;
  abre_min  int;
  fecha_min int;
  m         int;
  ini       timestamptz;
  fim_ts    timestamptz;
  limite    timestamptz;
begin
  select * into cfg from public.configuracoes where id = 1;
  select duracao_min into dur from public.servicos where id = p_servico and ativo;
  if dur is null or p_data is null then return; end if;

  hoje := (now() at time zone cfg.fuso)::date;
  if p_data < hoje or p_data > hoje + cfg.dias_max then return; end if;

  select * into hf from public.horarios_funcionamento where dia_semana = extract(dow from p_data);
  if hf.abre is null then return; end if;

  abre_min  := (extract(epoch from hf.abre) / 60)::int;
  fecha_min := (extract(epoch from hf.fecha) / 60)::int;
  limite    := now() + make_interval(mins => cfg.antecedencia_min);

  m := abre_min;
  while m + dur <= fecha_min loop
    ini    := (p_data + make_interval(mins => m)) at time zone cfg.fuso;
    fim_ts := ini + make_interval(mins => dur);
    if ini >= limite and exists (
      select 1 from public.barbeiros b
      where b.ativo
        and (p_barbeiro is null or b.id = p_barbeiro)
        and public.barbeiro_livre(b.id, ini, fim_ts)
    ) then
      horario := lpad((m / 60)::text, 2, '0') || ':' || lpad((m % 60)::text, 2, '0');
      return next;
    end if;
    m := m + cfg.intervalo_min;
  end loop;
end $$;

-- Cria o agendamento feito pelo cliente no site.
create or replace function public.criar_agendamento(
  p_servico     uuid,
  p_data        date,
  p_horario     text,
  p_nome        text,
  p_telefone    text,
  p_barbeiro    uuid default null,
  p_email       text default null,
  p_observacoes text default null
) returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg      public.configuracoes;
  srv      public.servicos;
  v_tel    text;
  v_nome   text := trim(coalesce(p_nome, ''));
  v_email  text := nullif(trim(coalesce(p_email, '')), '');
  v_obs    text := nullif(trim(coalesce(p_observacoes, '')), '');
  ini      timestamptz;
  fim_ts   timestamptz;
  barb_id  uuid;
  barb_nm  text;
  cli_id   uuid;
  ag       public.agendamentos;
begin
  select * into cfg from public.configuracoes where id = 1;

  -- Validação dos dados do cliente
  if length(v_nome) < 2 or length(v_nome) > 80 then
    raise exception 'Informe seu nome (2 a 80 caracteres).';
  end if;
  v_tel := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if length(v_tel) in (12, 13) and left(v_tel, 2) = '55' then v_tel := substr(v_tel, 3); end if;
  if length(v_tel) not in (10, 11) then
    raise exception 'Informe um telefone válido com DDD.';
  end if;
  if v_email is not null and (length(v_email) > 120 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'E-mail inválido.';
  end if;
  if v_obs is not null and length(v_obs) > 500 then
    raise exception 'As observações devem ter no máximo 500 caracteres.';
  end if;
  if p_horario !~ '^[0-2][0-9]:[0-5][0-9]$' then
    raise exception 'Horário inválido.';
  end if;

  select * into srv from public.servicos where id = p_servico and ativo;
  if srv.id is null then
    raise exception 'Serviço indisponível.';
  end if;

  -- O horário precisa estar na lista de horários livres
  if not exists (select 1 from public.horarios_livres(p_servico, p_data, p_barbeiro) h where h.horario = p_horario) then
    raise exception 'Esse horário não está mais disponível. Escolha outro.';
  end if;

  ini    := (p_data + p_horario::time) at time zone cfg.fuso;
  fim_ts := ini + make_interval(mins => srv.duracao_min);

  -- Barbeiro: o escolhido ou, sem preferência, o livre com menos atendimentos no dia
  if p_barbeiro is not null then
    select b.id, b.nome into barb_id, barb_nm from public.barbeiros b where b.id = p_barbeiro and b.ativo;
  else
    select b.id, b.nome into barb_id, barb_nm
    from public.barbeiros b
    where b.ativo and public.barbeiro_livre(b.id, ini, fim_ts)
    order by (
      select count(*) from public.agendamentos a
      where a.barbeiro_id = b.id
        and a.status in ('agendado', 'confirmado', 'concluido')
        and (a.inicio at time zone cfg.fuso)::date = p_data
    ), b.ordem, b.nome
    limit 1;
  end if;
  if barb_id is null then
    raise exception 'Esse horário não está mais disponível. Escolha outro.';
  end if;

  -- Proteção contra abuso: no máximo 3 agendamentos futuros por telefone
  if (
    select count(*) from public.agendamentos a
    join public.clientes c on c.id = a.cliente_id
    where c.telefone = v_tel and a.status in ('agendado', 'confirmado') and a.inicio > now()
  ) >= 3 then
    raise exception 'Você já tem 3 agendamentos em aberto. Fale com a barbearia para marcar mais.';
  end if;

  -- Cliente: reaproveita pelo telefone (não sobrescreve o nome já cadastrado)
  insert into public.clientes (nome, telefone, email)
  values (v_nome, v_tel, v_email)
  on conflict (telefone) do update set email = coalesce(public.clientes.email, excluded.email)
  returning id into cli_id;

  begin
    insert into public.agendamentos (cliente_id, barbeiro_id, servico_id, inicio, fim, preco, observacoes, origem)
    values (cli_id, barb_id, srv.id, ini, fim_ts, srv.preco, v_obs, 'site')
    returning * into ag;
  exception when exclusion_violation then
    raise exception 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro.';
  end;

  return json_build_object(
    'token',    ag.token,
    'servico',  srv.nome,
    'barbeiro', barb_nm,
    'data',     to_char(p_data, 'DD/MM/YYYY'),
    'horario',  p_horario,
    'preco',    srv.preco,
    'preco_a_partir', srv.preco_a_partir
  );
end $$;

-- Consulta pública de um agendamento pelo token do link.
create or replace function public.consultar_agendamento(p_token uuid)
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'servico',       s.nome,
    'barbeiro',      b.nome,
    'data',          to_char(a.inicio at time zone cfg.fuso, 'DD/MM/YYYY'),
    'horario',       to_char(a.inicio at time zone cfg.fuso, 'HH24:MI'),
    'status',        a.status,
    'pode_cancelar', a.status in ('agendado', 'confirmado') and a.inicio > now()
  )
  from public.agendamentos a
  join public.servicos s  on s.id = a.servico_id
  join public.barbeiros b on b.id = a.barbeiro_id
  cross join public.configuracoes cfg
  where a.token = p_token
$$;

-- Cancelamento pelo cliente (link com token).
create or replace function public.cancelar_agendamento(p_token uuid)
returns json
language plpgsql volatile security definer set search_path = public as $$
declare
  ag public.agendamentos;
begin
  select * into ag from public.agendamentos where token = p_token for update;
  if ag.id is null then
    raise exception 'Agendamento não encontrado.';
  end if;
  if ag.status not in ('agendado', 'confirmado') or ag.inicio <= now() then
    raise exception 'Este agendamento não pode mais ser cancelado pelo site.';
  end if;
  update public.agendamentos set status = 'cancelado' where id = ag.id;
  return public.consultar_agendamento(p_token);
end $$;

-- =========================================================
-- PAINEL ADMIN (funções usadas pela equipe logada)
-- =========================================================

-- Dono gerencia todos os barbeiros; barbeiro só a si mesmo (uso interno)
create or replace function public.pode_gerenciar(p_barbeiro uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.eh_dono() or (p_barbeiro is not null and p_barbeiro = public.meu_barbeiro_id()), false)
$$;

-- Agendamento lançado pela equipe (balcão, telefone). Aceita qualquer horário,
-- inclusive fora da grade, desde que o barbeiro esteja livre.
create or replace function public.criar_agendamento_admin(
  p_servico     uuid,
  p_barbeiro    uuid,
  p_data        date,
  p_horario     text,
  p_nome        text,
  p_telefone    text,
  p_observacoes text default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg    public.configuracoes;
  srv    public.servicos;
  v_nome text := trim(coalesce(p_nome, ''));
  v_tel  text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  ini    timestamptz;
  cli_id uuid;
  novo   uuid;
begin
  if not public.pode_gerenciar(p_barbeiro) then
    raise exception 'Sem permissão para agendar para este barbeiro.';
  end if;
  if length(v_nome) < 2 or length(v_nome) > 80 then
    raise exception 'Informe o nome do cliente.';
  end if;
  if length(v_tel) in (12, 13) and left(v_tel, 2) = '55' then v_tel := substr(v_tel, 3); end if;
  if length(v_tel) not in (10, 11) then
    raise exception 'Informe um telefone válido com DDD.';
  end if;
  if p_data is null or coalesce(p_horario, '') !~ '^[0-2][0-9]:[0-5][0-9]$' then
    raise exception 'Informe data e horário.';
  end if;

  select * into cfg from public.configuracoes where id = 1;
  select * into srv from public.servicos where id = p_servico;
  if srv.id is null then
    raise exception 'Serviço inválido.';
  end if;
  if not exists (select 1 from public.barbeiros where id = p_barbeiro and ativo) then
    raise exception 'Barbeiro inválido.';
  end if;

  ini := (p_data + p_horario::time) at time zone cfg.fuso;

  insert into public.clientes (nome, telefone)
  values (v_nome, v_tel)
  on conflict (telefone) do update set nome = public.clientes.nome
  returning id into cli_id;

  begin
    insert into public.agendamentos (cliente_id, barbeiro_id, servico_id, inicio, fim, preco, observacoes, origem, status)
    values (cli_id, p_barbeiro, srv.id, ini, ini + make_interval(mins => srv.duracao_min), srv.preco,
            nullif(trim(coalesce(p_observacoes, '')), ''), 'admin', 'confirmado')
    returning id into novo;
  exception when exclusion_violation then
    raise exception 'O barbeiro já tem um atendimento nesse horário.';
  end;
  return novo;
end $$;

-- Confirmar, cancelar, marcar falta ou voltar para "agendado".
create or replace function public.alterar_status_agendamento(p_id uuid, p_status text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  ag public.agendamentos;
begin
  select * into ag from public.agendamentos where id = p_id for update;
  if ag.id is null then
    raise exception 'Agendamento não encontrado.';
  end if;
  if not public.pode_gerenciar(ag.barbeiro_id) then
    raise exception 'Sem permissão para alterar este agendamento.';
  end if;
  if p_status not in ('agendado', 'confirmado', 'cancelado', 'faltou') then
    raise exception 'Status inválido.';
  end if;
  if ag.status = 'concluido' then
    raise exception 'Atendimento já concluído. Peça ao dono para desfazer a conclusão.';
  end if;
  begin
    update public.agendamentos set status = p_status where id = p_id;
  exception when exclusion_violation then
    raise exception 'Esse horário já foi ocupado por outro agendamento.';
  end;
end $$;

-- Concluir o atendimento e registrar o pagamento no financeiro.
create or replace function public.concluir_atendimento(p_id uuid, p_valor numeric, p_forma text)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg      public.configuracoes;
  ag       public.agendamentos;
  srv_nome text;
  cli_nome text;
begin
  select * into ag from public.agendamentos where id = p_id for update;
  if ag.id is null then
    raise exception 'Agendamento não encontrado.';
  end if;
  if not public.pode_gerenciar(ag.barbeiro_id) then
    raise exception 'Sem permissão para concluir este atendimento.';
  end if;
  if ag.status = 'concluido' then
    raise exception 'Este atendimento já foi concluído.';
  end if;
  if ag.status = 'cancelado' then
    raise exception 'Este agendamento está cancelado.';
  end if;
  if p_valor is null or p_valor < 0 then
    raise exception 'Valor inválido.';
  end if;
  if p_forma not in ('dinheiro', 'pix', 'debito', 'credito', 'assinatura', 'outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select * into cfg from public.configuracoes where id = 1;
  select nome into srv_nome from public.servicos where id = ag.servico_id;
  select nome into cli_nome from public.clientes where id = ag.cliente_id;

  update public.agendamentos set status = 'concluido' where id = p_id;

  if p_valor > 0 then
    insert into public.lancamentos (tipo, categoria, descricao, valor, forma_pagamento, data, agendamento_id, barbeiro_id)
    values ('entrada', 'atendimento', srv_nome || ' — ' || cli_nome, p_valor, p_forma,
            (ag.inicio at time zone cfg.fuso)::date, ag.id, ag.barbeiro_id);
  end if;
end $$;

-- Desfazer uma conclusão lançada por engano (só o dono): apaga o pagamento e volta para "confirmado".
create or replace function public.desfazer_conclusao(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.eh_dono() then
    raise exception 'Apenas o dono pode desfazer uma conclusão.';
  end if;
  if not exists (select 1 from public.agendamentos where id = p_id and status = 'concluido') then
    raise exception 'Este atendimento não está concluído.';
  end if;
  delete from public.lancamentos where agendamento_id = p_id and categoria = 'atendimento';
  update public.agendamentos set status = 'confirmado' where id = p_id;
end $$;

-- =========================================================
-- PERMISSÕES DE EXECUÇÃO
-- =========================================================
revoke execute on function public.barbeiro_livre(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.novo_usuario() from public, anon, authenticated;
revoke execute on function public.papel_atual()     from public, anon;
revoke execute on function public.eh_dono()         from public, anon;
revoke execute on function public.eh_equipe()       from public, anon;
revoke execute on function public.meu_barbeiro_id() from public, anon;
grant  execute on function public.papel_atual()     to authenticated;
grant  execute on function public.eh_dono()         to authenticated;
grant  execute on function public.eh_equipe()       to authenticated;
grant  execute on function public.meu_barbeiro_id() to authenticated;

grant execute on function public.horarios_livres(uuid, date, uuid) to anon, authenticated;
grant execute on function public.criar_agendamento(uuid, date, text, text, text, uuid, text, text) to anon, authenticated;
grant execute on function public.consultar_agendamento(uuid) to anon, authenticated;
grant execute on function public.cancelar_agendamento(uuid) to anon, authenticated;

revoke execute on function public.pode_gerenciar(uuid) from public, anon, authenticated;
revoke execute on function public.criar_agendamento_admin(uuid, uuid, date, text, text, text, text) from public, anon;
revoke execute on function public.alterar_status_agendamento(uuid, text) from public, anon;
revoke execute on function public.concluir_atendimento(uuid, numeric, text) from public, anon;
revoke execute on function public.desfazer_conclusao(uuid) from public, anon;
grant  execute on function public.criar_agendamento_admin(uuid, uuid, date, text, text, text, text) to authenticated;
grant  execute on function public.alterar_status_agendamento(uuid, text) to authenticated;
grant  execute on function public.concluir_atendimento(uuid, numeric, text) to authenticated;
grant  execute on function public.desfazer_conclusao(uuid) to authenticated;
