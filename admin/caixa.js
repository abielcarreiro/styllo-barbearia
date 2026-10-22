/* =========================================================
   Painel: CAIXA (só o dono)
   Entradas e saídas do mês, lançamentos manuais (despesas, produtos,
   assinaturas), comissão por barbeiro e exportação em CSV.
   Os atendimentos concluídos na Agenda entram aqui sozinhos.
   ========================================================= */
(function () {
  "use strict";
  const A = window.Admin;

  const CATEGORIAS = {
    entrada: [["produto", "Venda de produto"], ["assinatura", "Assinatura / plano"], ["atendimento_avulso", "Atendimento (lançado à mão)"], ["outros", "Outros"]],
    saida: [["aluguel", "Aluguel"], ["material", "Material / produtos"], ["salario", "Salário / comissão paga"], ["contas", "Contas (luz, água, internet)"], ["outros", "Outros"]]
  };
  const NOMES_CATEGORIA = {
    atendimento: "Atendimento", atendimento_avulso: "Atendimento", produto: "Produto", assinatura: "Assinatura",
    aluguel: "Aluguel", material: "Material", salario: "Salário / comissão", contas: "Contas", outros: "Outros"
  };
  const FORMAS = { pix: "Pix", dinheiro: "Dinheiro", debito: "Débito", credito: "Crédito", assinatura: "Plano", outro: "Outro" };

  const estado = { mes: null, lista: [], barbeiros: [] };
  let secao;

  function iniciar(el) {
    secao = el;
    estado.mes = A.hojeISO().slice(0, 7);
    secao.innerHTML =
      '<div class="admin-head">' +
        "<h1>Caixa</h1>" +
        '<div class="toolbar-acoes">' +
          '<button class="btn btn--ghost btn--sm" type="button" data-acao="csv">Exportar CSV</button>' +
          '<button class="btn btn--primary btn--sm" type="button" data-acao="novo">+ Lançamento</button>' +
        "</div>" +
      "</div>" +
      '<p class="dica">Os atendimentos concluídos na Agenda entram aqui sozinhos. Use “+ Lançamento” para despesas, venda de produtos e outras entradas.</p>' +
      '<div class="toolbar">' +
        '<div class="date-nav">' +
          '<button class="icon-btn" type="button" data-acao="anterior" aria-label="Mês anterior">‹</button>' +
          '<label class="visually-hidden" for="caixa-mes">Mês</label>' +
          '<input class="input-sm" type="month" id="caixa-mes">' +
          '<button class="icon-btn" type="button" data-acao="proximo" aria-label="Próximo mês">›</button>' +
        "</div>" +
      "</div>" +
      '<div class="stats" id="caixa-stats"></div>' +
      '<div class="admin-head admin-head--sub"><h2>Comissões do mês</h2></div>' +
      '<p class="dica">Calculada sobre os atendimentos de cada barbeiro. O percentual de cada um fica em Equipe.</p>' +
      '<div id="caixa-comissoes"></div>' +
      '<div class="admin-head admin-head--sub"><h2>Lançamentos</h2></div>' +
      '<div id="caixa-lista"></div>';

    A.$("#caixa-mes", secao).addEventListener("change", function () {
      if (this.value) { estado.mes = this.value; carregar(); }
    });
    secao.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-acao]");
      if (!btn) return;
      const acao = btn.dataset.acao;
      if (acao === "anterior") { estado.mes = mudarMes(estado.mes, -1); carregar(); }
      else if (acao === "proximo") { estado.mes = mudarMes(estado.mes, 1); carregar(); }
      else if (acao === "novo") novo();
      else if (acao === "csv") exportar();
      else if (acao === "apagar") apagar(btn.dataset.id);
    });
  }

  function mudarMes(mes, n) {
    const p = mes.split("-").map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1 + n, 1));
    return d.toISOString().slice(0, 7);
  }

  function carregar() {
    A.$("#caixa-mes", secao).value = estado.mes;
    A.$("#caixa-lista", secao).innerHTML = '<p class="muted">Carregando…</p>';
    const inicio = estado.mes + "-01";
    const fim = mudarMes(estado.mes, 1) + "-01";
    return Promise.all([
      A.ok(A.db.from("lancamentos").select("id, tipo, categoria, descricao, valor, forma_pagamento, data, barbeiro_id, agendamento_id")
        .gte("data", inicio).lt("data", fim).order("data", { ascending: false }).order("criado_em", { ascending: false })),
      A.ok(A.db.from("barbeiros").select("id, nome, ativo, comissao_percent").order("ordem"))
    ]).then(function (r) {
      estado.lista = r[0];
      estado.barbeiros = r[1];
      renderStats();
      renderComissoes();
      renderLista();
    }).catch(function (err) {
      A.$("#caixa-lista", secao).innerHTML = '<p class="muted">' + A.esc(A.mensagemErro(err, "Não foi possível carregar o caixa.")) + "</p>";
    });
  }

  function soma(lista) { return lista.reduce(function (s, l) { return s + Number(l.valor); }, 0); }
  function nomeBarbeiro(id) {
    const b = estado.barbeiros.find(function (x) { return x.id === id; });
    return b ? b.nome : "";
  }

  function stat(rotulo, valor, destaque) {
    return '<div class="stat' + (destaque ? " stat--destaque" : "") + '"><span class="stat-valor">' + valor +
      '</span><span class="stat-rotulo">' + rotulo + "</span></div>";
  }

  function renderStats() {
    const entradas = estado.lista.filter(function (l) { return l.tipo === "entrada"; });
    const saidas = estado.lista.filter(function (l) { return l.tipo === "saida"; });
    const atend = entradas.filter(function (l) { return l.categoria === "atendimento"; });
    A.$("#caixa-stats", secao).innerHTML =
      stat("Entradas", A.dinheiro(soma(entradas))) +
      stat("Saídas", A.dinheiro(soma(saidas))) +
      stat("Saldo do mês", A.dinheiro(soma(entradas) - soma(saidas)), true) +
      stat("Atendimentos pagos", atend.length);
  }

  function renderComissoes() {
    const linhas = estado.barbeiros.map(function (b) {
      const atend = estado.lista.filter(function (l) {
        return l.tipo === "entrada" && l.categoria === "atendimento" && l.barbeiro_id === b.id;
      });
      const faturado = soma(atend);
      const pct = Number(b.comissao_percent) || 0;
      return { b: b, qtd: atend.length, faturado: faturado, pct: pct, comissao: faturado * pct / 100 };
    }).filter(function (x) { return x.qtd > 0 || x.b.ativo; });

    A.$("#caixa-comissoes", secao).innerHTML = linhas.length
      ? '<div class="tabela-wrap"><table class="tabela"><thead><tr>' +
          '<th>Barbeiro</th><th class="num">Atendimentos</th><th class="num">Faturado</th><th class="num">Comissão</th><th class="num">A pagar</th>' +
        "</tr></thead><tbody>" +
        linhas.map(function (x) {
          return "<tr>" +
            '<td data-rotulo="Barbeiro">' + A.esc(x.b.nome) + "</td>" +
            '<td data-rotulo="Atendimentos" class="num">' + x.qtd + "</td>" +
            '<td data-rotulo="Faturado" class="num">' + A.dinheiro(x.faturado) + "</td>" +
            '<td data-rotulo="Comissão" class="num">' + x.pct.toLocaleString("pt-BR") + "%</td>" +
            '<td data-rotulo="A pagar" class="num"><strong>' + A.dinheiro(x.comissao) + "</strong></td>" +
          "</tr>";
        }).join("") + "</tbody></table></div>"
      : '<div class="vazio"><p>Nenhum barbeiro cadastrado.</p></div>';
  }

  function renderLista() {
    const el = A.$("#caixa-lista", secao);
    if (!estado.lista.length) {
      el.innerHTML = '<div class="vazio"><p>Nenhum lançamento neste mês.</p></div>';
      return;
    }
    el.innerHTML =
      '<div class="tabela-wrap"><table class="tabela"><thead><tr>' +
        '<th>Data</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th class="num">Valor</th><th><span class="visually-hidden">Ações</span></th>' +
      "</tr></thead><tbody>" +
      estado.lista.map(function (l) {
        const entrada = l.tipo === "entrada";
        const barb = l.barbeiro_id ? nomeBarbeiro(l.barbeiro_id) : "";
        return "<tr>" +
          '<td data-rotulo="Data">' + A.dataCurta(l.data) + "</td>" +
          '<td data-rotulo="Descrição">' + A.esc(l.descricao || "—") + (barb ? ' <span class="tag">' + A.esc(barb) + "</span>" : "") + "</td>" +
          '<td data-rotulo="Categoria">' + A.esc(NOMES_CATEGORIA[l.categoria] || l.categoria) + "</td>" +
          '<td data-rotulo="Forma">' + A.esc(FORMAS[l.forma_pagamento] || "—") + "</td>" +
          '<td data-rotulo="Valor" class="num ' + (entrada ? "valor-entrada" : "valor-saida") + '">' + (entrada ? "+ " : "− ") + A.dinheiro(l.valor) + "</td>" +
          '<td class="td-acoes">' + (l.agendamento_id
            ? '<span class="muted" title="Para desfazer, use “Desfazer conclusão” na Agenda">Agenda</span>'
            : '<button class="btn btn--ghost btn--sm" type="button" data-acao="apagar" data-id="' + l.id + '">Apagar</button>') + "</td>" +
        "</tr>";
      }).join("") +
      "</tbody></table></div>";
  }

  function novo() {
    const opcoes = function (tipo) {
      return CATEGORIAS[tipo].map(function (c) { return '<option value="' + c[0] + '">' + c[1] + "</option>"; }).join("");
    };
    A.dialogo({
      titulo: "Novo lançamento",
      corpo:
        '<div class="field"><span class="field-rotulo">Tipo</span>' +
          '<label class="check"><input type="radio" name="tipo" value="saida" checked> Saída (despesa)</label>' +
          '<label class="check"><input type="radio" name="tipo" value="entrada"> Entrada</label>' +
        "</div>" +
        '<div class="field"><label for="l-cat">Categoria</label><select id="l-cat" name="categoria">' + opcoes("saida") + "</select></div>" +
        '<div class="field"><label for="l-desc">Descrição</label><input id="l-desc" name="descricao" type="text" maxlength="120" placeholder="Ex.: Conta de luz de outubro"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="l-valor">Valor (R$)</label><input id="l-valor" name="valor" type="number" min="0.01" step="0.01" inputmode="decimal"></div>' +
          '<div class="field"><label for="l-data">Data</label><input id="l-data" name="data" type="date" value="' + A.hojeISO() + '"></div>' +
        "</div>" +
        '<div class="field-row">' +
          '<div class="field"><label for="l-forma">Forma de pagamento</label><select id="l-forma" name="forma">' +
            Object.keys(FORMAS).map(function (k) { return '<option value="' + k + '">' + FORMAS[k] + "</option>"; }).join("") +
          "</select></div>" +
          '<div class="field"><label for="l-barb">Barbeiro <span class="optional">(opcional)</span></label><select id="l-barb" name="barbeiro">' +
            '<option value="">Nenhum</option>' +
            estado.barbeiros.map(function (b) { return '<option value="' + b.id + '">' + A.esc(b.nome) + "</option>"; }).join("") +
          "</select></div>" +
        "</div>",
      aoAbrir: function (form) {
        A.$$('input[name="tipo"]', form).forEach(function (r) {
          r.addEventListener("change", function () { form.categoria.innerHTML = opcoes(this.value); });
        });
      },
      aoEnviar: function (form, fechar) {
        const v = A.valores(form);
        const valor = Number(String(v.valor).replace(",", "."));
        if (!(valor > 0)) throw "Informe um valor maior que zero.";
        if (!v.data) throw "Informe a data.";
        if (v.descricao.length < 2) throw "Descreva o lançamento.";
        return A.ok(A.db.from("lancamentos").insert({
          tipo: v.tipo,
          categoria: v.categoria === "atendimento_avulso" ? "atendimento" : v.categoria,
          descricao: v.descricao,
          valor: valor,
          forma_pagamento: v.forma,
          data: v.data,
          barbeiro_id: v.barbeiro || null
        }).select("id")).then(function () {
          fechar();
          A.aviso("Lançamento registrado.");
          if (v.data.slice(0, 7) !== estado.mes) estado.mes = v.data.slice(0, 7);
          carregar();
        });
      }
    });
  }

  function apagar(id) {
    const l = estado.lista.find(function (x) { return x.id === id; });
    if (!l || !window.confirm("Apagar o lançamento “" + (l.descricao || "") + "” de " + A.dinheiro(l.valor) + "?")) return;
    A.ok(A.db.from("lancamentos").delete().eq("id", id).select("id"))
      .then(function () {
        A.aviso("Lançamento apagado.");
        carregar();
      })
      .catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  function exportar() {
    if (!estado.lista.length) {
      A.aviso("Nenhum lançamento para exportar neste mês.", "erro");
      return;
    }
    const cel = function (t) { return '"' + String(t == null ? "" : t).replace(/"/g, '""') + '"'; };
    const linhas = [["Data", "Tipo", "Categoria", "Descrição", "Barbeiro", "Forma", "Valor"]].concat(
      estado.lista.map(function (l) {
        return [
          A.dataCurta(l.data), l.tipo === "entrada" ? "Entrada" : "Saída", NOMES_CATEGORIA[l.categoria] || l.categoria,
          l.descricao || "", nomeBarbeiro(l.barbeiro_id), FORMAS[l.forma_pagamento] || "",
          (l.tipo === "saida" ? -1 : 1) * Number(l.valor)
        ];
      })
    );
    // ";" e vírgula decimal abrem certo no Excel em português
    const csv = "﻿" + linhas.map(function (r) {
      return r.map(function (c) { return typeof c === "number" ? c.toFixed(2).replace(".", ",") : cel(c); }).join(";");
    }).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "caixa-" + estado.mes + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  A.modulo("caixa", { titulo: "Caixa", somenteDono: true, iniciar: iniciar, mostrar: carregar });
})();
