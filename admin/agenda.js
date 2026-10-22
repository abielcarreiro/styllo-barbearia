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
    servicos: [],
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
        '<button class="btn btn--primary btn--sm" type="button" data-acao="novo">+ Novo agendamento</button>' +
      "</div>" +
      '<p class="dica">Agendamentos do site e os lançados aqui no painel (cliente que ligou ou chegou sem marcar). A lista se atualiza sozinha a cada minuto.</p>' +
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
      else if (acao === "novo") novoAgendamento();
      else if (acao === "concluir") concluir(id);
      else if (acao === "desfazer") desfazer(id);
      else if (acao === "reenviar") enviarConfirmacao(buscar(id), abrirJanela());
      else mudarStatus(id, acao);
    });

    // Novo agendamento pelo site: recarrega a lista se estiver aberta
    document.addEventListener("styllo:novo-agendamento", function () {
      if (!secao.hidden && !document.querySelector("dialog[open]")) carregar(true);
    });

    // Serviços para o novo agendamento
    A.ok(A.db.from("servicos").select("id, nome, duracao_min, preco, preco_a_partir").eq("ativo", true).order("ordem"))
      .then(function (s) { estado.servicos = s; })
      .catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });

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
      .select("id, inicio, fim, status, preco, observacoes, origem, token, barbeiro_id, clientes(nome, telefone), servicos(nome, preco_a_partir), barbeiros(nome)")
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

  const BARBEARIA = (window.STYLLO && window.STYLLO.barbearia) || {};

  function urlWhatsApp(a, msg) {
    const tel = String(a.clientes.telefone || "").replace(/\D/g, "");
    return "https://wa.me/55" + tel + "?text=" + encodeURIComponent(msg);
  }

  function linkWhatsApp(a) {
    const msg = "Olá, " + a.clientes.nome.split(" ")[0] + "! Passando para lembrar do seu horário na " +
      (BARBEARIA.nome || "barbearia") + ": " + a.servicos.nome + ", " + A.dataCurta(A.dataISO(a.inicio)) +
      " às " + A.hora(a.inicio) + ". Até lá!";
    return urlWhatsApp(a, msg);
  }

  // "segunda-feira, 05/10"
  function dataMensagem(ts) {
    const iso = A.dataISO(ts);
    const p = iso.split("-").map(Number);
    const semana = new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long" });
    return semana + ", " + iso.slice(8, 10) + "/" + iso.slice(5, 7);
  }

  // Mensagem de confirmação enviada ao cliente
  function mensagemConfirmacao(a) {
    const valor = Number(a.preco) > 0
      ? (a.servicos.preco_a_partir ? "a partir de " : "") + A.dinheiro(a.preco)
      : null;
    const linkCancelar = new URL("../cancelar.html?t=" + encodeURIComponent(a.token), location.href).href;
    return [
      "✅ *Agendamento confirmado!*",
      "",
      "Olá, " + a.clientes.nome.split(" ")[0] + "! Seu horário na *" + (BARBEARIA.nome || "barbearia") + "* está confirmado:",
      "",
      "✂️ *Serviço:* " + a.servicos.nome,
      "💈 *Barbeiro:* " + a.barbeiros.nome,
      "📅 *Data:* " + dataMensagem(a.inicio),
      "🕐 *Horário:* " + A.hora(a.inicio),
      valor ? "💰 *Valor:* " + valor : null,
      "",
      BARBEARIA.endereco ? "📍 " + BARBEARIA.endereco : null,
      BARBEARIA.endereco ? "" : null,
      "Precisa cancelar? Acesse: " + linkCancelar,
      "Te esperamos!"
    ].filter(function (linha) { return linha !== null; }).join("\n");
  }

  // Abre o WhatsApp com a confirmação. A janela é aberta no clique (antes da
  // resposta do servidor) para o navegador não bloquear; se bloquear, mostra um botão.
  function enviarConfirmacao(a, janela) {
    const url = urlWhatsApp(a, mensagemConfirmacao(a));
    if (janela && !janela.closed) {
      janela.location.href = url;
      return;
    }
    A.dialogo({
      titulo: "Enviar confirmação",
      confirmar: false,
      corpo:
        '<p class="muted">Envie a confirmação para ' + A.esc(a.clientes.nome) + " pelo WhatsApp:</p>" +
        '<a class="btn btn--primary btn--block" href="' + A.esc(url) + '" target="_blank" rel="noopener">Enviar no WhatsApp</a>'
    });
  }

  function abrirJanela() {
    const janela = window.open("", "_blank");
    if (janela) {
      janela.opener = null;
      janela.document.write('<p style="font-family:sans-serif;padding:24px">Abrindo o WhatsApp…</p>');
    }
    return janela;
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
    if (a.status === "confirmado") return b("concluir", "Concluir", "btn--primary") + b("reenviar", "Reenviar confirmação") + b("faltou", "Faltou") + b("cancelado", "Cancelar");
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
              (a.origem === "admin" ? '<span class="badge badge--origem" title="Lançado pelo painel">Balcão</span>' : "") +
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
    const janela = status === "confirmado" ? abrirJanela() : null;
    A.ok(A.db.rpc("alterar_status_agendamento", { p_id: id, p_status: status }))
      .then(function () {
        if (status === "confirmado") {
          enviarConfirmacao(a, janela);
          A.aviso("Agendamento confirmado. Envie a mensagem no WhatsApp.");
        } else {
          A.aviso("Agendamento atualizado.");
        }
        carregar(true);
      })
      .catch(function (err) {
        if (janela) janela.close();
        A.aviso(A.mensagemErro(err), "erro");
      });
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

  /* ---------- Novo agendamento pelo painel ---------- */
  function novoAgendamento() {
    if (!estado.servicos.length) {
      A.aviso("Cadastre ou ative um serviço antes de agendar.", "erro");
      return;
    }
    const ativos = estado.barbeiros.filter(function (b) { return b.ativo; });
    const opcoesBarbeiro = A.ehDono()
      ? ativos.map(function (b) {
          return '<option value="' + b.id + '"' + (b.id === estado.barbeiro ? " selected" : "") + ">" + A.esc(b.nome) + "</option>";
        }).join("")
      : '<option value="' + A.perfil.barbeiro_id + '">Eu</option>';

    A.dialogo({
      titulo: "Novo agendamento",
      confirmar: "Agendar",
      corpo:
        '<div class="field"><label for="n-serv">Serviço</label><select id="n-serv" name="servico">' +
          estado.servicos.map(function (s) {
            return '<option value="' + s.id + '">' + A.esc(s.nome) + " · " + s.duracao_min + " min</option>";
          }).join("") +
        "</select></div>" +
        '<div class="field"><label for="n-barb">Barbeiro</label><select id="n-barb" name="barbeiro">' + opcoesBarbeiro + "</select></div>" +
        '<div class="field-row">' +
          '<div class="field"><label for="n-dia">Dia</label><input id="n-dia" name="dia" type="date" value="' + estado.dia + '"></div>' +
          '<div class="field"><label for="n-hora">Horário</label><input id="n-hora" name="hora" type="time" step="300"></div>' +
        "</div>" +
        '<p class="dica" data-livres>Carregando horários livres…</p>' +
        '<div class="field"><label for="n-nome">Nome do cliente</label><input id="n-nome" name="nome" type="text" maxlength="80" autocomplete="off"></div>' +
        '<div class="field"><label for="n-tel">WhatsApp do cliente</label><input id="n-tel" name="telefone" type="tel" inputmode="tel" placeholder="(00) 00000-0000"></div>' +
        '<div class="field"><label for="n-obs">Observações <span class="optional">(opcional)</span></label><textarea id="n-obs" name="observacoes" maxlength="500"></textarea></div>',
      aoAbrir: function (form) {
        A.mascaraTelefone(form.telefone);
        const livres = A.$("[data-livres]", form);
        let pedido = 0;

        // Sugere os horários livres do dia; o horário pode ser digitado à mão (encaixe)
        const buscarLivres = function () {
          const n = ++pedido;
          if (!form.dia.value || !form.barbeiro.value) return;
          livres.textContent = "Carregando horários livres…";
          A.ok(A.db.rpc("horarios_livres", { p_servico: form.servico.value, p_data: form.dia.value, p_barbeiro: form.barbeiro.value }))
            .then(function (r) {
              if (n !== pedido) return;
              livres.innerHTML = r.length
                ? "Livres: <span class=\"chips\">" + r.map(function (h) {
                    return '<button type="button" data-hora="' + h.horario + '" aria-pressed="' + (form.hora.value === h.horario) + '">' + h.horario + "</button>";
                  }).join("") + "</span>"
                : "Nenhum horário livre na grade deste dia. Você ainda pode digitar um horário de encaixe.";
            })
            .catch(function () { if (n === pedido) livres.textContent = "Digite o horário."; });
        };
        livres.addEventListener("click", function (e) {
          const b = e.target.closest("[data-hora]");
          if (!b) return;
          form.hora.value = b.dataset.hora;
          A.$$("[data-hora]", livres).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        });
        form.servico.addEventListener("change", buscarLivres);
        form.barbeiro.addEventListener("change", buscarLivres);
        form.dia.addEventListener("change", buscarLivres);
        buscarLivres();
      },
      aoEnviar: function (form, fechar) {
        const v = A.valores(form);
        if (!v.barbeiro) throw "Escolha o barbeiro.";
        if (!v.dia || !v.hora) throw "Informe o dia e o horário.";
        if (v.nome.length < 2) throw "Informe o nome do cliente.";
        if (v.telefone.replace(/\D/g, "").length < 10) throw "Informe o WhatsApp com DDD.";
        return A.ok(A.db.rpc("criar_agendamento_admin", {
          p_servico: v.servico,
          p_barbeiro: v.barbeiro,
          p_data: v.dia,
          p_horario: v.hora.slice(0, 5),
          p_nome: v.nome,
          p_telefone: v.telefone,
          p_observacoes: v.observacoes || null
        })).then(function () {
          fechar();
          A.aviso("Agendamento criado.");
          if (estado.dia !== v.dia) estado.dia = v.dia;
          carregar(true);
        });
      }
    });
  }

  A.modulo("agenda", { titulo: "Agenda", iniciar: iniciar, mostrar: mostrar });
})();
