/* =========================================================
   Painel: AGENDA DO DIA
   Mostra os agendamentos feitos pelos clientes no site.
   Dono vê todos os barbeiros (com filtro); barbeiro vê só a própria agenda.
   ========================================================= */
(function () {
  "use strict";
  const A = window.Admin;

  const STATUS = {
    agendado:   { rotulo: "Agendado",       classe: "st-agendado" },
    confirmado: { rotulo: "Confirmado",     classe: "st-confirmado" },
    concluido:  { rotulo: "Concluído",      classe: "st-concluido" },
    cancelado:  { rotulo: "Cancelado",      classe: "st-cancelado" },
    faltou:     { rotulo: "Não compareceu", classe: "st-faltou" }
  };
  const FORMAS = [
    ["pix", "Pix"], ["dinheiro", "Dinheiro"], ["debito", "Cartão de débito"],
    ["credito", "Cartão de crédito"], ["assinatura", "Plano / assinatura"], ["outro", "Outro"]
  ];

  const estado = {
    dia: null,
    barbeiro: "",       // filtro (dono)
    barbeiros: [],
    lista: [],
    timer: null
  };
  let secao;

  /* ---------- Estrutura ---------- */
  function iniciar(el) {
    secao = el;
    estado.dia = A.hojeISO();
    secao.innerHTML =
      '<div class="admin-head">' +
        "<h1>Agenda</h1>" +
      "</div>" +
      '<p class="dica">Agendamentos feitos pelos clientes no site. A lista se atualiza sozinha a cada minuto.</p>' +
      '<div class="toolbar">' +
        '<div class="date-nav">' +
          '<button class="icon-btn" type="button" data-acao="anterior" aria-label="Dia anterior">‹</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-acao="hoje">Hoje</button>' +
          '<button class="icon-btn" type="button" data-acao="proximo" aria-label="Próximo dia">›</button>' +
          '<label class="visually-hidden" for="agenda-dia">Dia</label>' +
          '<input class="input-sm" type="date" id="agenda-dia">' +
        "</div>" +
        (A.ehDono()
          ? '<label class="visually-hidden" for="agenda-barbeiro">Barbeiro</label>' +
            '<select class="input-sm" id="agenda-barbeiro"><option value="">Todos os barbeiros</option></select>'
          : "") +
      "</div>" +
      '<h2 class="agenda-dia-titulo" id="agenda-titulo"></h2>' +
      '<div class="stats" id="agenda-stats"></div>' +
      '<div class="ag-lista" id="agenda-lista" aria-live="polite"></div>';

    A.$("#agenda-dia", secao).addEventListener("change", function () {
      if (this.value) { estado.dia = this.value; carregar(); }
    });
    const filtro = A.$("#agenda-barbeiro", secao);
    if (filtro) filtro.addEventListener("change", function () { estado.barbeiro = this.value; carregar(); });

    secao.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-acao]");
      if (!btn) return;
      const acao = btn.dataset.acao;
      const id = btn.dataset.id;
      if (acao === "anterior") { estado.dia = A.addDias(estado.dia, -1); carregar(); }
      else if (acao === "proximo") { estado.dia = A.addDias(estado.dia, 1); carregar(); }
      else if (acao === "hoje") { estado.dia = A.hojeISO(); carregar(); }
      else if (acao === "concluir") concluir(id);
      else if (acao === "desfazer") desfazer(id);
      else mudarStatus(id, acao);
    });

    // Barbeiros para o filtro do dono
    A.ok(A.db.from("barbeiros").select("id, nome, ativo").order("ordem")).then(function (barbeiros) {
      estado.barbeiros = barbeiros;
      if (filtro) {
        filtro.innerHTML = '<option value="">Todos os barbeiros</option>' + estado.barbeiros.map(function (b) {
          return '<option value="' + b.id + '">' + A.esc(b.nome) + (b.ativo ? "" : " (inativo)") + "</option>";
        }).join("");
      }
    }).catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  function mostrar() {
    carregar();
    // Atualiza sozinho a cada minuto enquanto a agenda estiver aberta
    clearInterval(estado.timer);
    estado.timer = setInterval(function () {
      if (!secao.hidden && !document.hidden && !document.querySelector("dialog[open]")) carregar(true);
      if (secao.hidden) clearInterval(estado.timer);
    }, 60000);
  }

  /* ---------- Dados ---------- */
  function carregar(silencioso) {
    A.$("#agenda-dia", secao).value = estado.dia;
    A.$("#agenda-titulo", secao).textContent =
      (estado.dia === A.hojeISO() ? "Hoje, " : "") + A.dataLonga(estado.dia);
    if (!silencioso) A.$("#agenda-lista", secao).innerHTML = '<p class="muted">Carregando…</p>';

    let q = A.db.from("agendamentos")
      .select("id, inicio, fim, status, preco, observacoes, barbeiro_id, clientes(nome, telefone), servicos(nome), barbeiros(nome)")
      .eq("origem", "site")
      .gte("inicio", A.momento(estado.dia))
      .lt("inicio", A.momento(A.addDias(estado.dia, 1)))
      .order("inicio");
    let f = A.db.from("lancamentos").select("valor")
      .eq("data", estado.dia).eq("tipo", "entrada").eq("categoria", "atendimento");
    if (estado.barbeiro) {
      q = q.eq("barbeiro_id", estado.barbeiro);
      f = f.eq("barbeiro_id", estado.barbeiro);
    }

    return Promise.all([A.ok(q), A.ok(f)]).then(function (r) {
      estado.lista = r[0];
      renderStats(r[0], r[1]);
      renderLista(r[0]);
    }).catch(function (err) {
      A.$("#agenda-lista", secao).innerHTML = '<p class="muted">' + A.esc(A.mensagemErro(err, "Não foi possível carregar a agenda.")) + "</p>";
    });
  }

  /* ---------- Renderização ---------- */
  function renderStats(lista, lancamentos) {
    const conta = function (sts) { return lista.filter(function (a) { return sts.indexOf(a.status) !== -1; }).length; };
    const faturado = lancamentos.reduce(function (s, l) { return s + Number(l.valor); }, 0);
    A.$("#agenda-stats", secao).innerHTML =
      stat("A atender", conta(["agendado", "confirmado"])) +
      stat("Concluídos", conta(["concluido"])) +
      stat("Faltas / cancelados", conta(["faltou", "cancelado"])) +
      stat("Faturado no dia", A.dinheiro(faturado), true);
  }

  function stat(rotulo, valor, destaque) {
    return '<div class="stat' + (destaque ? " stat--destaque" : "") + '"><span class="stat-valor">' + valor +
      '</span><span class="stat-rotulo">' + rotulo + "</span></div>";
  }

  function linkWhatsApp(a) {
    const tel = String(a.clientes.telefone || "").replace(/\D/g, "");
    const msg = "Olá, " + a.clientes.nome.split(" ")[0] + "! Passando para lembrar do seu horário na Fino Trato Barbearia: " +
      a.servicos.nome + ", " + A.dataCurta(estado.dia) + " às " + A.hora(a.inicio) + ". Até lá!";
    return "https://wa.me/55" + tel + "?text=" + encodeURIComponent(msg);
  }

  function formatarTelefone(t) {
    const d = String(t || "").replace(/\D/g, "");
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return t;
  }

  function botoes(a) {
    const b = function (acao, rotulo, extra) {
      return '<button class="btn btn--sm ' + (extra || "btn--ghost") + '" type="button" data-acao="' + acao + '" data-id="' + a.id + '">' + rotulo + "</button>";
    };
    if (a.status === "agendado") return b("concluir", "Concluir", "btn--primary") + b("confirmado", "Confirmar") + b("faltou", "Faltou") + b("cancelado", "Cancelar");
    if (a.status === "confirmado") return b("concluir", "Concluir", "btn--primary") + b("faltou", "Faltou") + b("cancelado", "Cancelar");
    if (a.status === "concluido") return A.ehDono() ? b("desfazer", "Desfazer conclusão") : "";
    return b("agendado", "Reativar");
  }

  function renderLista(lista) {
    const el = A.$("#agenda-lista", secao);
    if (!lista.length) {
      el.innerHTML = '<div class="vazio"><p>Nenhum agendamento neste dia.</p></div>';
      return;
    }
    const mostrarBarbeiro = A.ehDono() && !estado.barbeiro;
    el.innerHTML = lista.map(function (a) {
      const st = STATUS[a.status] || { rotulo: a.status, classe: "" };
      const inativo = a.status === "cancelado" || a.status === "faltou";
      return (
        '<article class="ag' + (inativo ? " ag--inativo" : "") + '">' +
          '<div class="ag-hora"><strong>' + A.hora(a.inicio) + "</strong><span>" + A.hora(a.fim) + "</span></div>" +
          '<div class="ag-info">' +
            '<p class="ag-cliente">' + A.esc(a.clientes.nome) +
              ' <span class="badge ' + st.classe + '">' + st.rotulo + "</span>" +
            "</p>" +
            '<p class="ag-detalhe">' + A.esc(a.servicos.nome) +
              (mostrarBarbeiro ? " · " + A.esc(a.barbeiros.nome) : "") +
              " · " + A.dinheiro(a.preco) + "</p>" +
            '<p class="ag-detalhe"><a href="' + linkWhatsApp(a) + '" target="_blank" rel="noopener" title="Enviar lembrete pelo WhatsApp">' +
              formatarTelefone(a.clientes.telefone) + " · lembrar no WhatsApp</a></p>" +
            (a.observacoes ? '<p class="ag-obs">“' + A.esc(a.observacoes) + "”</p>" : "") +
          "</div>" +
          '<div class="ag-acoes">' + botoes(a) + "</div>" +
        "</article>"
      );
    }).join("");
  }

  /* ---------- Ações ---------- */
  function buscar(id) { return estado.lista.find(function (a) { return a.id === id; }); }

  function mudarStatus(id, status) {
    const a = buscar(id);
    const perguntas = {
      cancelado: "Cancelar o agendamento de " + a.clientes.nome + "? O horário será liberado.",
      faltou: "Marcar que " + a.clientes.nome + " não compareceu?"
    };
    if (perguntas[status] && !window.confirm(perguntas[status])) return;
    A.ok(A.db.rpc("alterar_status_agendamento", { p_id: id, p_status: status }))
      .then(function () {
        A.aviso("Agendamento atualizado.");
        carregar(true);
      })
      .catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  function concluir(id) {
    const a = buscar(id);
    A.dialogo({
      titulo: "Concluir atendimento",
      confirmar: "Concluir e registrar",
      corpo:
        '<p class="muted">' + A.esc(a.clientes.nome) + " · " + A.esc(a.servicos.nome) + " · " + A.hora(a.inicio) + "</p>" +
        '<div class="field-row">' +
          '<div class="field"><label for="c-valor">Valor recebido (R$)</label>' +
            '<input id="c-valor" name="valor" type="number" min="0" step="0.01" inputmode="decimal" value="' + Number(a.preco).toFixed(2) + '"></div>' +
          '<div class="field"><label for="c-forma">Forma de pagamento</label>' +
            '<select id="c-forma" name="forma">' + FORMAS.map(function (f) {
              return '<option value="' + f[0] + '">' + f[1] + "</option>";
            }).join("") + "</select></div>" +
        "</div>" +
        '<p class="dica">Para serviços "a partir de", ajuste o valor cobrado. Em "Plano / assinatura" o valor fica R$ 0,00.</p>',
      aoAbrir: function (form) {
        form.forma.addEventListener("change", function () {
          if (this.value === "assinatura") form.valor.value = "0.00";
        });
      },
      aoEnviar: function (form, fechar) {
        const v = A.valores(form);
        const valor = Number(String(v.valor).replace(",", "."));
        if (!(valor >= 0)) throw "Informe o valor recebido.";
        return A.ok(A.db.rpc("concluir_atendimento", { p_id: id, p_valor: valor, p_forma: v.forma })).then(function () {
          fechar();
          A.aviso("Atendimento concluído" + (valor > 0 ? " e " + A.dinheiro(valor) + " registrado no caixa." : "."));
          carregar(true);
        });
      }
    });
  }

  function desfazer(id) {
    const a = buscar(id);
    if (!window.confirm("Desfazer a conclusão de " + a.clientes.nome + "? O pagamento registrado será apagado.")) return;
    A.ok(A.db.rpc("desfazer_conclusao", { p_id: id }))
      .then(function () {
        A.aviso("Conclusão desfeita.");
        carregar(true);
      })
      .catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  A.modulo("agenda", { titulo: "Agenda", iniciar: iniciar, mostrar: mostrar });
})();
