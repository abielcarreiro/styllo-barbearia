/* =========================================================
   NAVALHA NOBRE BARBEARIA — demo/demo-db.js
   Banco de dados LOCAL para a demonstração do portfólio.

   Imita a parte do cliente do Supabase que o site e o painel usam
   (from/select/insert/update/delete/upsert, filtros, junções, rpc,
   auth e storage), com os dados guardados no localStorage do navegador.
   As funções do banco (supabase/schema.sql) foram reescritas aqui em
   JavaScript com as mesmas regras.

   Cada visitante tem os próprios dados e começa do zero: ninguém vê o teste de outra pessoa.
   Para usar o Supabase de verdade, desligue "demo" em config.js.
   ========================================================= */
(function () {
  "use strict";

  const CHAVE = "navalha-demo:v2"; // v2: a demonstração passou a começar sem agendamentos
  const CHAVE_SESSAO = "navalha-demo:sessao";
  const OFFSET_H = 3; // America/Fortaleza = UTC-3, sem horário de verão
  const OFFSET = "-03:00";
  const MIN = 60000;

  /* ---------- Contas de demonstração (aparecem na tela de login) ---------- */
  const CONTAS = [
    { email: "dono@navalhanobre.demo", senha: "navalha123", papel: "dono", rotulo: "Dono", resumo: "Vê tudo: agenda, caixa, equipe e ajustes" },
    { email: "lucas@navalhanobre.demo", senha: "barbeiro123", papel: "barbeiro", rotulo: "Barbeiro", resumo: "Vê só a própria agenda e o próprio caixa" }
  ];

  /* ---------- Utilidades ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  const clone = function (v) { return v == null ? v : JSON.parse(JSON.stringify(v)); };
  const pad = function (n) { return String(n).padStart(2, "0"); };

  // Datas no fuso da barbearia
  const momento = function (data, hhmm) { return new Date(data + "T" + hhmm + ":00" + OFFSET); };
  const dataLocal = function (ts) { return new Date(new Date(ts).getTime() - OFFSET_H * 3600000).toISOString().slice(0, 10); };
  const horaLocal = function (ts) { return new Date(new Date(ts).getTime() - OFFSET_H * 3600000).toISOString().slice(11, 16); };
  const hoje = function () { return dataLocal(Date.now()); };
  const addDias = function (iso, n) {
    const p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  };
  const diaSemana = function (iso) { return new Date(iso + "T12:00:00Z").getUTCDay(); };
  const minutos = function (hhmm) { const p = hhmm.split(":").map(Number); return p[0] * 60 + p[1]; };
  const hhmm = function (m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); };
  const brData = function (iso) { return iso.split("-").reverse().join("/"); };

  function erro(mensagem) { return { code: "P0001", message: mensagem }; }

  /* =========================================================
     DADOS INICIAIS: só o cadastro da barbearia (serviços, barbeiros, horários
     e acessos). Começa sem clientes, agendamentos nem caixa, para testar do zero.
     ========================================================= */
  const SERVICOS = [
    ["corte", "Corte de Cabelo", "Cabelo", 30, 35, true, null],
    ["corte-tesoura", "Corte na Tesoura", "Cabelo", 30, 35, false, null],
    ["pezinho", "Pezinho", "Cabelo", 10, 15, false, null],
    ["escova", "Escova", "Cabelo", 10, 15, false, null],
    ["barba", "Barba", "Barba e sobrancelha", 15, 35, false, null],
    ["sobrancelha", "Sobrancelhas", "Barba e sobrancelha", 10, 15, false, null],
    ["hidratacao", "Hidratação", "Tratamentos e química", 10, 20, false, null],
    ["botox", "Botox", "Tratamentos e química", 30, 60, true, "Valor inicial de R$ 60,00. O valor final é definido após a avaliação do cabelo."],
    ["selagem", "Selagem Capilar", "Tratamentos e química", 50, 60, true, "Valor inicial de R$ 60,00. O valor final é definido após a avaliação do cabelo."],
    ["progressiva", "Progressiva", "Tratamentos e química", 30, 70, true, "Valor inicial de R$ 70,00. O valor final é definido após a avaliação do cabelo."],
    ["luzes", "Luzes", "Tratamentos e química", 90, 90, true, null],
    ["platinado", "Platinado", "Tratamentos e química", 180, 104, false, "Promoção: de R$ 130,00 por R$ 104,00."],
    ["corte-sobrancelha-hidratacao", "Corte + Sobrancelhas + Hidratação", "Combos", 60, 70, false, null],
    ["corte-barba", "Corte + Barba", "Combos", 45, 70, true, null],
    ["corte-barba-sobrancelha", "Corte + Barba + Sobrancelhas", "Combos", 55, 85, false, null],
    ["corte-barba-hidratacao", "Corte + Barba + Hidratação", "Combos", 60, 90, false, null],
    ["corte-barba-selagem", "Corte + Barba + Selagem", "Combos", 80, 130, true, null],
    ["corte-barba-botox", "Corte + Barba + Botox", "Combos", 90, 130, true, null],
    ["corte-barba-selagem-sobrancelha", "Corte + Barba + Selagem + Sobrancelhas", "Combos", 90, 145, true, null]
  ];

  // Nomes usados pelo botão "Simular agendamento"
  const NOMES = ["João Pedro Alves", "Carlos Eduardo Lima", "Mateus Dantas", "Rafael Brito", "Gabriel Formiga", "Felipe Cavalcanti", "Bruno Queiroga", "Diego Araújo", "Thiago Lacerda", "Gustavo Nóbrega", "Lucas Wanderley", "André Medeiros", "Vinícius Batista", "Henrique Sousa", "Paulo Vitor", "Marcos Antônio", "Daniel Pereira", "Leonardo Rocha", "Caio Fernandes", "Igor Santana", "Ruan Diniz", "Samuel Torres", "Eduardo Leite", "Arthur Gomes", "Renan Oliveira", "Pedro Henrique", "Wesley Silva", "Matheus Costa", "Victor Hugo", "Davi Monteiro", "Otávio Ramos", "Emanuel Ferreira"];

  function semear() {
    const agora = Date.now();
    const criado = new Date(agora - 120 * 86400000).toISOString();

    const d = {
      configuracoes: [{ id: 1, fuso: "America/Fortaleza", intervalo_min: 30, antecedencia_min: 60, dias_max: 30, chave_pix: "pix@navalhanobre.demo", recebedor_pix: "Navalha Nobre", cidade_pix: "Patos" }],
      horarios_funcionamento: [
        { dia_semana: 0, abre: null, fecha: null },
        { dia_semana: 1, abre: "09:00", fecha: "19:00" },
        { dia_semana: 2, abre: "09:00", fecha: "19:00" },
        { dia_semana: 3, abre: "09:00", fecha: "19:00" },
        { dia_semana: 4, abre: "09:00", fecha: "19:00" },
        { dia_semana: 5, abre: "09:00", fecha: "19:00" },
        { dia_semana: 6, abre: "08:00", fecha: "18:00" }
      ],
      barbeiros: [
        { id: uuid(), nome: "Rafael Nóbrega", especialidade: "Cortes clássicos e navalha", instagram: "", foto_url: null, comissao_percent: 0, ativo: true, ordem: 1, criado_em: criado },
        { id: uuid(), nome: "Lucas Medeiros", especialidade: "Degradê e barba", instagram: "", foto_url: null, comissao_percent: 40, ativo: true, ordem: 2, criado_em: criado },
        { id: uuid(), nome: "Thiago Wanderley", especialidade: "Química e coloração", instagram: "", foto_url: null, comissao_percent: 40, ativo: true, ordem: 3, criado_em: criado }
      ],
      servicos: SERVICOS.map(function (s, i) {
        return { id: uuid(), slug: s[0], nome: s[1], categoria: s[2], duracao_min: s[3], preco: s[4], preco_a_partir: s[5], descricao: s[6], ativo: true, ordem: i + 1, criado_em: criado };
      }),
      perfis: [],
      credenciais: [],
      clientes: [],
      planos: [],
      assinaturas: [],
      agendamentos: [],
      bloqueios: [],
      lancamentos: []
    };

    // Acessos ao painel: dono, um barbeiro e um pedido de acesso pendente
    const lucas = d.barbeiros[1];
    [
      { email: CONTAS[0].email, senha: CONTAS[0].senha, nome: "Rafael (dono)", papel: "dono", barbeiro_id: null },
      { email: CONTAS[1].email, senha: CONTAS[1].senha, nome: "Lucas Medeiros", papel: "barbeiro", barbeiro_id: lucas.id },
      { email: "thiago@navalhanobre.demo", senha: null, nome: null, papel: "pendente", barbeiro_id: null }
    ].forEach(function (p, i) {
      const id = uuid();
      d.perfis.push({ id: id, email: p.email, nome: p.nome, papel: p.papel, barbeiro_id: p.barbeiro_id, criado_em: new Date(agora - (90 - i * 30) * 86400000).toISOString() });
      if (p.senha) d.credenciais.push({ user_id: id, email: p.email, senha: p.senha });
    });

    return d;
  }

  /* =========================================================
     ARMAZENAMENTO
     ========================================================= */
  let estado = null;

  function carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) return JSON.parse(bruto);
    } catch (e) { /* sem armazenamento: segue só em memória */ }
    const novo = semear();
    salvar(novo);
    return novo;
  }

  function salvar(d) {
    try { localStorage.setItem(CHAVE, JSON.stringify(d || estado)); } catch (e) { /* cota cheia ou modo privado */ }
  }

  function db() {
    if (!estado) estado = carregar();
    return estado;
  }

  // Outra aba mudou os dados: recarrega
  window.addEventListener("storage", function (e) {
    if (e.key === CHAVE) estado = null;
  });

  /* ---------- Sessão ---------- */
  function sessaoUserId() {
    try { return localStorage.getItem(CHAVE_SESSAO); } catch (e) { return null; }
  }
  function perfilAtual() {
    const id = sessaoUserId();
    return id ? db().perfis.find(function (p) { return p.id === id; }) || null : null;
  }
  const ehDono = function () { const p = perfilAtual(); return !!p && p.papel === "dono"; };
  const meuBarbeiro = function () { const p = perfilAtual(); return p && p.papel === "barbeiro" ? p.barbeiro_id : null; };
  const podeGerenciar = function (barbeiroId) { return ehDono() || (!!barbeiroId && barbeiroId === meuBarbeiro()); };

  /* =========================================================
     CONSULTAS (imita o PostgREST do Supabase)
     ========================================================= */
  const NUMERICOS = ["preco", "duracao_min", "ordem", "comissao_percent", "valor", "intervalo_min", "antecedencia_min", "dias_max", "usos_mes", "preco_mensal"];
  const CHAVES = { horarios_funcionamento: "dia_semana" };

  const ehMomento = function (v) { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v); };
  function comparar(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (ehMomento(a) && ehMomento(b)) return Date.parse(a) - Date.parse(b);
    if (typeof a === "number" || typeof b === "number") return Number(a) - Number(b);
    a = String(a); b = String(b);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // Regras de acesso (Row Level Security) que importam no painel
  function visivel(tabela, linha) {
    const p = perfilAtual();
    if (!p || p.papel === "dono") return true;
    const meu = meuBarbeiro();
    if (tabela === "agendamentos" || tabela === "lancamentos") return linha.barbeiro_id === meu;
    if (tabela === "perfis") return linha.id === p.id;
    return true;
  }

  // "id, nome, clientes(nome), agendamentos(id, servicos(nome))" -> lista de campos
  function lerColunas(texto) {
    const partes = [];
    let nivel = 0, atual = "";
    for (const c of String(texto || "*")) {
      if (c === "(") nivel++;
      if (c === ")") nivel--;
      if (c === "," && nivel === 0) { partes.push(atual.trim()); atual = ""; } else atual += c;
    }
    if (atual.trim()) partes.push(atual.trim());
    return partes.map(function (p) {
      const m = /^(\w+)\s*\(([\s\S]*)\)$/.exec(p);
      return m ? { nome: m[1], sub: lerColunas(m[2]) } : { nome: p };
    });
  }

  function projetar(tabela, linha, colunas) {
    const saida = {};
    colunas.forEach(function (c) {
      if (c.nome === "*" && !c.sub) { Object.assign(saida, clone(linha)); return; }
      if (!c.sub) { saida[c.nome] = clone(linha[c.nome]); return; }
      const fk = c.nome.replace(/s$/, "") + "_id";
      const relacionada = db()[c.nome] || [];
      if (fk in linha) {
        // Muitos-para-um: agendamento -> clientes(nome)
        const alvo = relacionada.find(function (x) { return x.id === linha[fk]; });
        saida[c.nome] = alvo ? projetar(c.nome, alvo, c.sub) : null;
      } else {
        // Um-para-muitos: cliente -> agendamentos(...)
        const fkInversa = tabela.replace(/s$/, "") + "_id";
        saida[c.nome] = relacionada
          .filter(function (x) { return x[fkInversa] === linha.id && visivel(c.nome, x); })
          .map(function (x) { return projetar(c.nome, x, c.sub); });
      }
    });
    return saida;
  }

  function normalizar(tabela, linha) {
    NUMERICOS.forEach(function (k) {
      if (k in linha && linha[k] !== null && linha[k] !== "") linha[k] = Number(linha[k]);
    });
    return linha;
  }

  function padroes(tabela) {
    const agora = new Date().toISOString();
    const base = { criado_em: agora };
    if (tabela !== "configuracoes" && tabela !== "horarios_funcionamento") base.id = uuid();
    const extra = {
      barbeiros: { especialidade: null, instagram: null, foto_url: null, comissao_percent: 0, ativo: true, ordem: 0 },
      servicos: { descricao: null, preco: 0, preco_a_partir: false, categoria: "Outros", ativo: true, ordem: 0 },
      clientes: { email: null },
      agendamentos: { status: "agendado", origem: "site", token: uuid(), observacoes: null, assinatura_id: null },
      bloqueios: { barbeiro_id: null, motivo: null },
      lancamentos: { descricao: null, forma_pagamento: null, data: hoje(), agendamento_id: null, assinatura_id: null, barbeiro_id: null, criado_por: sessaoUserId() },
      perfis: { nome: null, papel: "pendente", barbeiro_id: null }
    }[tabela] || {};
    return Object.assign(base, extra);
  }

  function Consulta(tabela) {
    this.tabela = tabela;
    this.op = "select";
    this.colunas = "*";
    this.retornar = false;
    this.filtros = [];
    this.ordens = [];
    this.limite = null;
    this.modo = null;
    this.dados = null;
  }
  const P = Consulta.prototype;
  P.select = function (cols) { if (this.op === "select") this.colunas = cols || "*"; else { this.retornar = true; this.colunas = cols || "*"; } return this; };
  P.insert = function (linhas) { this.op = "insert"; this.dados = linhas; return this; };
  P.upsert = function (linhas) { this.op = "upsert"; this.dados = linhas; return this; };
  P.update = function (campos) { this.op = "update"; this.dados = campos; return this; };
  P.delete = function () { this.op = "delete"; return this; };
  P.eq = function (c, v) { this.filtros.push(function (r) { return comparar(r[c], v) === 0; }); return this; };
  P.neq = function (c, v) { this.filtros.push(function (r) { return comparar(r[c], v) !== 0; }); return this; };
  P.gt = function (c, v) { this.filtros.push(function (r) { return r[c] != null && comparar(r[c], v) > 0; }); return this; };
  P.gte = function (c, v) { this.filtros.push(function (r) { return r[c] != null && comparar(r[c], v) >= 0; }); return this; };
  P.lt = function (c, v) { this.filtros.push(function (r) { return r[c] != null && comparar(r[c], v) < 0; }); return this; };
  P.lte = function (c, v) { this.filtros.push(function (r) { return r[c] != null && comparar(r[c], v) <= 0; }); return this; };
  P.in = function (c, lista) { this.filtros.push(function (r) { return lista.some(function (v) { return comparar(r[c], v) === 0; }); }); return this; };
  P.is = function (c, v) { this.filtros.push(function (r) { return r[c] === v; }); return this; };
  P.order = function (c, opcoes) { this.ordens.push({ c: c, asc: !opcoes || opcoes.ascending !== false }); return this; };
  P.limit = function (n) { this.limite = n; return this; };
  P.single = function () { this.modo = "single"; return this; };
  P.maybeSingle = function () { this.modo = "maybe"; return this; };
  P.then = function (ok, falha) {
    const self = this;
    return Promise.resolve().then(function () {
      try { return { data: self.executar(), error: null }; } catch (e) { return { data: null, error: e }; }
    }).then(ok, falha);
  };
  P.catch = function (falha) { return this.then(null, falha); };

  P.executar = function () {
    const d = db();
    const tabela = this.tabela;
    if (!d[tabela]) d[tabela] = [];
    const lista = d[tabela];
    const passa = this.filtros;
    const casa = function (r) { return passa.every(function (f) { return f(r); }) && visivel(tabela, r); };
    let afetadas;

    if (this.op === "select") {
      afetadas = lista.filter(casa);
    } else if (this.op === "insert" || this.op === "upsert") {
      const chave = CHAVES[tabela] || "id";
      afetadas = [].concat(this.dados).map(function (dado) {
        const existente = this.op === "upsert" && dado[chave] != null && lista.find(function (r) { return comparar(r[chave], dado[chave]) === 0; });
        if (existente) return Object.assign(existente, normalizar(tabela, clone(dado)));
        const nova = normalizar(tabela, Object.assign(padroes(tabela), clone(dado)));
        lista.push(nova);
        return nova;
      }, this);
      salvar();
    } else if (this.op === "update") {
      const campos = normalizar(tabela, clone(this.dados));
      afetadas = lista.filter(casa);
      afetadas.forEach(function (r) { Object.assign(r, campos); });
      salvar();
    } else if (this.op === "delete") {
      afetadas = lista.filter(casa);
      d[tabela] = lista.filter(function (r) { return afetadas.indexOf(r) === -1; });
      salvar();
    }

    if (this.op !== "select" && !this.retornar) return null;

    const ordens = this.ordens;
    if (ordens.length) {
      afetadas = afetadas.slice().sort(function (a, b) {
        for (const o of ordens) {
          const c = comparar(a[o.c], b[o.c]);
          if (c) return o.asc ? c : -c;
        }
        return 0;
      });
    }
    if (this.limite != null) afetadas = afetadas.slice(0, this.limite);
    const colunas = lerColunas(this.colunas);
    const linhas = afetadas.map(function (r) { return projetar(tabela, r, colunas); });

    if (this.modo === "single") {
      if (linhas.length !== 1) throw { code: "PGRST116", message: "Nenhum registro encontrado." };
      return linhas[0];
    }
    if (this.modo === "maybe") return linhas[0] || null;
    return linhas;
  };

  /* =========================================================
     FUNÇÕES DO BANCO (RPC) — mesmas regras do schema.sql
     ========================================================= */
  const ATIVOS = ["agendado", "confirmado", "concluido"];

  function barbeiroLivre(barbeiroId, ini, fim, ignorarId) {
    const d = db();
    return !d.agendamentos.some(function (a) {
      return a.id !== ignorarId && a.barbeiro_id === barbeiroId && ATIVOS.indexOf(a.status) !== -1 &&
        Date.parse(a.inicio) < fim && Date.parse(a.fim) > ini;
    }) && !d.bloqueios.some(function (k) {
      return (!k.barbeiro_id || k.barbeiro_id === barbeiroId) && Date.parse(k.inicio) < fim && Date.parse(k.fim) > ini;
    });
  }

  function telefone(t) {
    let v = String(t || "").replace(/\D/g, "");
    if ((v.length === 12 || v.length === 13) && v.slice(0, 2) === "55") v = v.slice(2);
    return v;
  }

  function horariosLivres(p) {
    const d = db();
    const cfg = d.configuracoes[0];
    const srv = d.servicos.find(function (s) { return s.id === p.p_servico && s.ativo; });
    if (!srv || !p.p_data) return [];
    const dia0 = hoje();
    if (p.p_data < dia0 || p.p_data > addDias(dia0, cfg.dias_max)) return [];
    const hf = d.horarios_funcionamento.find(function (h) { return h.dia_semana === diaSemana(p.p_data); });
    if (!hf || !hf.abre) return [];
    const limite = Date.now() + cfg.antecedencia_min * MIN;
    const dur = Number(srv.duracao_min);
    const saida = [];
    for (let m = minutos(hf.abre); m + dur <= minutos(hf.fecha); m += Number(cfg.intervalo_min)) {
      const ini = momento(p.p_data, hhmm(m)).getTime();
      const fim = ini + dur * MIN;
      if (ini < limite) continue;
      const algum = d.barbeiros.some(function (b) {
        return b.ativo && (!p.p_barbeiro || b.id === p.p_barbeiro) && barbeiroLivre(b.id, ini, fim);
      });
      if (algum) saida.push({ horario: hhmm(m) });
    }
    return saida;
  }

  function consultar(token) {
    const d = db();
    const a = d.agendamentos.find(function (x) { return x.token === token; });
    if (!a) return null;
    const s = d.servicos.find(function (x) { return x.id === a.servico_id; }) || {};
    const b = d.barbeiros.find(function (x) { return x.id === a.barbeiro_id; }) || {};
    return {
      servico: s.nome, barbeiro: b.nome, data: brData(dataLocal(a.inicio)), horario: horaLocal(a.inicio), status: a.status,
      pode_cancelar: (a.status === "agendado" || a.status === "confirmado") && Date.parse(a.inicio) > Date.now()
    };
  }

  function salvarCliente(nome, tel, email) {
    const d = db();
    let c = d.clientes.find(function (x) { return x.telefone === tel; });
    if (c) {
      if (!c.email && email) c.email = email;
    } else {
      c = { id: uuid(), nome: nome, telefone: tel, email: email || null, criado_em: new Date().toISOString() };
      d.clientes.push(c);
    }
    return c;
  }

  const RPC = {
    horarios_livres: horariosLivres,

    criar_agendamento: function (p) {
      const d = db();
      const nome = String(p.p_nome || "").trim();
      const email = String(p.p_email || "").trim() || null;
      const obs = String(p.p_observacoes || "").trim() || null;
      if (nome.length < 2 || nome.length > 80) throw erro("Informe seu nome (2 a 80 caracteres).");
      const tel = telefone(p.p_telefone);
      if (tel.length !== 10 && tel.length !== 11) throw erro("Informe um telefone válido com DDD.");
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw erro("E-mail inválido.");
      if (obs && obs.length > 500) throw erro("As observações devem ter no máximo 500 caracteres.");
      if (!/^[0-2][0-9]:[0-5][0-9]$/.test(p.p_horario || "")) throw erro("Horário inválido.");
      const srv = d.servicos.find(function (s) { return s.id === p.p_servico && s.ativo; });
      if (!srv) throw erro("Serviço indisponível.");
      if (!horariosLivres(p).some(function (h) { return h.horario === p.p_horario; })) throw erro("Esse horário não está mais disponível. Escolha outro.");

      const ini = momento(p.p_data, p.p_horario).getTime();
      const fim = ini + srv.duracao_min * MIN;
      let barb;
      if (p.p_barbeiro) {
        barb = d.barbeiros.find(function (b) { return b.id === p.p_barbeiro && b.ativo; });
      } else {
        // Sem preferência: o livre com menos atendimentos no dia
        const contagem = function (b) {
          return d.agendamentos.filter(function (a) { return a.barbeiro_id === b.id && ATIVOS.indexOf(a.status) !== -1 && dataLocal(a.inicio) === p.p_data; }).length;
        };
        barb = d.barbeiros
          .filter(function (b) { return b.ativo && barbeiroLivre(b.id, ini, fim); })
          .sort(function (a, b) { return contagem(a) - contagem(b) || a.ordem - b.ordem || a.nome.localeCompare(b.nome); })[0];
      }
      if (!barb) throw erro("Esse horário não está mais disponível. Escolha outro.");

      const abertos = d.agendamentos.filter(function (a) {
        const c = d.clientes.find(function (x) { return x.id === a.cliente_id; });
        return c && c.telefone === tel && (a.status === "agendado" || a.status === "confirmado") && Date.parse(a.inicio) > Date.now();
      });
      if (abertos.length >= 3) throw erro("Você já tem 3 agendamentos em aberto. Fale com a barbearia para marcar mais.");

      const cli = salvarCliente(nome, tel, email);
      const ag = Object.assign(padroes("agendamentos"), {
        cliente_id: cli.id, barbeiro_id: barb.id, servico_id: srv.id, inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString(),
        preco: srv.preco, observacoes: obs, origem: "site", status: "agendado"
      });
      d.agendamentos.push(ag);
      salvar();
      return { token: ag.token, servico: srv.nome, barbeiro: barb.nome, data: brData(p.p_data), horario: p.p_horario, preco: srv.preco, preco_a_partir: srv.preco_a_partir };
    },

    consultar_agendamento: function (p) { return consultar(p.p_token); },

    cancelar_agendamento: function (p) {
      const a = db().agendamentos.find(function (x) { return x.token === p.p_token; });
      if (!a) throw erro("Agendamento não encontrado.");
      if ((a.status !== "agendado" && a.status !== "confirmado") || Date.parse(a.inicio) <= Date.now()) throw erro("Este agendamento não pode mais ser cancelado pelo site.");
      a.status = "cancelado";
      salvar();
      return consultar(p.p_token);
    },

    criar_agendamento_admin: function (p) {
      const d = db();
      if (!podeGerenciar(p.p_barbeiro)) throw erro("Sem permissão para agendar para este barbeiro.");
      const nome = String(p.p_nome || "").trim();
      if (nome.length < 2 || nome.length > 80) throw erro("Informe o nome do cliente.");
      const tel = telefone(p.p_telefone);
      if (tel.length !== 10 && tel.length !== 11) throw erro("Informe um telefone válido com DDD.");
      if (!p.p_data || !/^[0-2][0-9]:[0-5][0-9]$/.test(p.p_horario || "")) throw erro("Informe data e horário.");
      const srv = d.servicos.find(function (s) { return s.id === p.p_servico; });
      if (!srv) throw erro("Serviço inválido.");
      if (!d.barbeiros.some(function (b) { return b.id === p.p_barbeiro && b.ativo; })) throw erro("Barbeiro inválido.");
      const ini = momento(p.p_data, p.p_horario).getTime();
      const fim = ini + srv.duracao_min * MIN;
      const conflito = d.agendamentos.some(function (a) {
        return a.barbeiro_id === p.p_barbeiro && ATIVOS.indexOf(a.status) !== -1 && Date.parse(a.inicio) < fim && Date.parse(a.fim) > ini;
      });
      if (conflito) throw erro("O barbeiro já tem um atendimento nesse horário.");
      const cli = salvarCliente(nome, tel, null);
      const ag = Object.assign(padroes("agendamentos"), {
        cliente_id: cli.id, barbeiro_id: p.p_barbeiro, servico_id: srv.id, inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString(),
        preco: srv.preco, observacoes: String(p.p_observacoes || "").trim() || null, origem: "admin", status: "confirmado"
      });
      d.agendamentos.push(ag);
      salvar();
      return ag.id;
    },

    alterar_status_agendamento: function (p) {
      const d = db();
      const a = d.agendamentos.find(function (x) { return x.id === p.p_id; });
      if (!a) throw erro("Agendamento não encontrado.");
      if (!podeGerenciar(a.barbeiro_id)) throw erro("Sem permissão para alterar este agendamento.");
      if (["agendado", "confirmado", "cancelado", "faltou"].indexOf(p.p_status) === -1) throw erro("Status inválido.");
      if (a.status === "concluido") throw erro("Atendimento já concluído. Peça ao dono para desfazer a conclusão.");
      if (ATIVOS.indexOf(p.p_status) !== -1 && ATIVOS.indexOf(a.status) === -1) {
        const conflito = d.agendamentos.some(function (x) {
          return x.id !== a.id && x.barbeiro_id === a.barbeiro_id && ATIVOS.indexOf(x.status) !== -1 &&
            Date.parse(x.inicio) < Date.parse(a.fim) && Date.parse(x.fim) > Date.parse(a.inicio);
        });
        if (conflito) throw erro("Esse horário já foi ocupado por outro agendamento.");
      }
      a.status = p.p_status;
      salvar();
      return null;
    },

    concluir_atendimento: function (p) {
      const d = db();
      const a = d.agendamentos.find(function (x) { return x.id === p.p_id; });
      if (!a) throw erro("Agendamento não encontrado.");
      if (!podeGerenciar(a.barbeiro_id)) throw erro("Sem permissão para concluir este atendimento.");
      if (a.status === "concluido") throw erro("Este atendimento já foi concluído.");
      if (a.status === "cancelado") throw erro("Este agendamento está cancelado.");
      const valor = Number(p.p_valor);
      if (p.p_valor == null || isNaN(valor) || valor < 0) throw erro("Valor inválido.");
      if (["dinheiro", "pix", "debito", "credito", "assinatura", "outro"].indexOf(p.p_forma) === -1) throw erro("Forma de pagamento inválida.");
      const srv = d.servicos.find(function (x) { return x.id === a.servico_id; }) || {};
      const cli = d.clientes.find(function (x) { return x.id === a.cliente_id; }) || {};
      a.status = "concluido";
      if (valor > 0) {
        d.lancamentos.push(Object.assign(padroes("lancamentos"), {
          tipo: "entrada", categoria: "atendimento", descricao: srv.nome + " — " + cli.nome, valor: valor, forma_pagamento: p.p_forma,
          data: dataLocal(a.inicio), agendamento_id: a.id, barbeiro_id: a.barbeiro_id
        }));
      }
      salvar();
      return null;
    },

    desfazer_conclusao: function (p) {
      const d = db();
      if (!ehDono()) throw erro("Apenas o dono pode desfazer uma conclusão.");
      const a = d.agendamentos.find(function (x) { return x.id === p.p_id && x.status === "concluido"; });
      if (!a) throw erro("Este atendimento não está concluído.");
      d.lancamentos = d.lancamentos.filter(function (l) { return !(l.agendamento_id === a.id && l.categoria === "atendimento"); });
      a.status = "confirmado";
      salvar();
      return null;
    }
  };

  /* =========================================================
     LOGIN (imita supabase.auth)
     ========================================================= */
  function usuario(perfil) { return perfil ? { id: perfil.id, email: perfil.email } : null; }

  const auth = {
    getSession: function () {
      const p = perfilAtual();
      return Promise.resolve({ data: { session: p ? { user: usuario(p) } : null }, error: null });
    },
    signInWithPassword: function (cred) {
      const d = db();
      const email = String(cred.email || "").trim().toLowerCase();
      const c = d.credenciais.find(function (x) { return x.email === email && x.senha === cred.password; });
      if (!c) return Promise.resolve({ data: { user: null, session: null }, error: { message: "Invalid login credentials", status: 400 } });
      try { localStorage.setItem(CHAVE_SESSAO, c.user_id); } catch (e) { /* sessão só nesta página */ }
      const u = usuario(d.perfis.find(function (x) { return x.id === c.user_id; }));
      return Promise.resolve({ data: { user: u, session: { user: u } }, error: null });
    },
    signOut: function () {
      try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* nada a limpar */ }
      return Promise.resolve({ error: null });
    },
    onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
    resetPasswordForEmail: function () { return Promise.resolve({ data: {}, error: null }); },
    updateUser: function (dados) {
      const p = perfilAtual();
      const c = p && db().credenciais.find(function (x) { return x.user_id === p.id; });
      if (c && dados.password) { c.senha = dados.password; salvar(); }
      return Promise.resolve({ data: { user: usuario(p) }, error: null });
    }
  };

  /* ---------- Fotos (imita supabase.storage; a foto fica no próprio cadastro) ---------- */
  const arquivos = {};
  const storage = {
    from: function (bucket) {
      return {
        upload: function (caminho, blob) {
          return new Promise(function (resolve) {
            const leitor = new FileReader();
            leitor.onload = function () {
              arquivos[bucket + "/" + caminho] = leitor.result;
              resolve({ data: { path: caminho }, error: null });
            };
            leitor.onerror = function () { resolve({ data: null, error: { message: "Não foi possível ler a foto." } }); };
            leitor.readAsDataURL(blob);
          });
        },
        getPublicUrl: function (caminho) { return { data: { publicUrl: arquivos[bucket + "/" + caminho] || "" } }; },
        remove: function () { return Promise.resolve({ data: [], error: null }); }
      };
    }
  };

  /* =========================================================
     API PÚBLICA
     ========================================================= */
  function criarCliente() {
    return {
      from: function (tabela) { return new Consulta(tabela); },
      rpc: function (nome, params) {
        return Promise.resolve().then(function () {
          if (!RPC[nome]) return { data: null, error: { message: "Função " + nome + " não existe na demonstração." } };
          try { return { data: clone(RPC[nome](params || {})), error: null }; } catch (e) { return { data: null, error: e }; }
        });
      },
      auth: auth,
      storage: storage
    };
  }

  /** Agendamento de um "cliente" fictício no próximo horário livre (botão da barra Demo) */
  function simularAgendamento() {
    const d = db();
    const servicos = d.servicos.filter(function (s) { return s.ativo && ["corte", "corte-barba", "barba", "corte-barba-sobrancelha"].indexOf(s.slug) !== -1; });
    const srv = servicos[Math.floor(Math.random() * servicos.length)] || d.servicos[0];
    for (let n = 0; n < 14; n++) {
      const dia = addDias(hoje(), n);
      const livres = horariosLivres({ p_servico: srv.id, p_data: dia });
      if (!livres.length) continue;
      const h = livres[Math.floor(Math.random() * Math.min(livres.length, 6))].horario;
      const nome = NOMES[Math.floor(Math.random() * NOMES.length)];
      const r = RPC.criar_agendamento({ p_servico: srv.id, p_data: dia, p_horario: h, p_nome: nome, p_telefone: "8398" + String(1000000 + Math.floor(Math.random() * 8999999)) });
      return Object.assign({ cliente: nome }, r);
    }
    throw erro("Não há horários livres nos próximos dias.");
  }

  window.DemoDB = {
    contas: CONTAS,
    createClient: criarCliente,
    simularAgendamento: simularAgendamento,
    restaurar: function () {
      estado = semear();
      salvar();
      try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* nada */ }
    }
  };
})();
