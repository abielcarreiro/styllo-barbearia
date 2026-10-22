/* =========================================================
   Painel: CLIENTES (só o dono)
   Lista quem já agendou, com visitas, última visita e histórico.
   ========================================================= */
(function () {
  "use strict";
  const A = window.Admin;

  const STATUS = { agendado: "Agendado", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Não compareceu" };
  let secao;
  let clientes = [];
  let termo = "";

  function iniciar(el) {
    secao = el;
    secao.innerHTML =
      '<div class="admin-head"><h1>Clientes</h1></div>' +
      '<p class="dica">Todo cliente que agenda pelo site ou pelo painel aparece aqui, identificado pelo WhatsApp.</p>' +
      '<div class="toolbar">' +
        '<label class="visually-hidden" for="cli-busca">Buscar cliente</label>' +
        '<input class="input-sm busca" type="search" id="cli-busca" placeholder="Buscar por nome ou telefone">' +
        '<span class="muted" id="cli-total"></span>' +
      "</div>" +
      '<div id="cli-lista"></div>';

    A.$("#cli-busca", secao).addEventListener("input", function () {
      termo = this.value.trim().toLowerCase();
      render();
    });
    secao.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-acao='ver']");
      if (btn) ver(btn.dataset.id);
    });
  }

  function carregar() {
    A.$("#cli-lista", secao).innerHTML = '<p class="muted">Carregando…</p>';
    return A.ok(A.db.from("clientes")
      .select("id, nome, telefone, email, criado_em, agendamentos(id, inicio, status, preco, servicos(nome), barbeiros(nome))")
      .order("nome"))
      .then(function (r) {
        clientes = r.map(function (c) {
          const ags = (c.agendamentos || []).slice().sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; });
          const feitos = ags.filter(function (a) { return a.status === "concluido"; });
          return Object.assign(c, {
            agendamentos: ags,
            visitas: feitos.length,
            ultima: feitos.length ? feitos[0].inicio : null,
            faltas: ags.filter(function (a) { return a.status === "faltou"; }).length
          });
        });
        render();
      })
      .catch(function (err) {
        A.$("#cli-lista", secao).innerHTML = '<p class="muted">' + A.esc(A.mensagemErro(err, "Não foi possível carregar os clientes.")) + "</p>";
      });
  }

  function telefone(t) {
    const d = String(t || "").replace(/\D/g, "");
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return t;
  }

  function render() {
    const digitos = termo.replace(/\D/g, "");
    const lista = clientes.filter(function (c) {
      if (!termo) return true;
      return c.nome.toLowerCase().indexOf(termo) !== -1 || (digitos && c.telefone.indexOf(digitos) !== -1);
    });
    A.$("#cli-total", secao).textContent = lista.length + (lista.length === 1 ? " cliente" : " clientes");
    const el = A.$("#cli-lista", secao);
    if (!lista.length) {
      el.innerHTML = '<div class="vazio"><p>' + (termo ? "Nenhum cliente encontrado." : "Nenhum cliente ainda.") + "</p></div>";
      return;
    }
    el.innerHTML =
      '<div class="tabela-wrap"><table class="tabela"><thead><tr>' +
        '<th>Cliente</th><th>WhatsApp</th><th class="num">Visitas</th><th>Última visita</th><th><span class="visually-hidden">Ações</span></th>' +
      "</tr></thead><tbody>" +
      lista.map(function (c) {
        return "<tr>" +
          '<td data-rotulo="Cliente">' + A.esc(c.nome) + (c.faltas ? ' <span class="tag" title="Faltas">' + c.faltas + (c.faltas === 1 ? " falta" : " faltas") + "</span>" : "") + "</td>" +
          '<td data-rotulo="WhatsApp"><a href="https://wa.me/55' + c.telefone + '" target="_blank" rel="noopener">' + telefone(c.telefone) + "</a></td>" +
          '<td data-rotulo="Visitas" class="num">' + c.visitas + "</td>" +
          '<td data-rotulo="Última visita">' + (c.ultima ? A.dataCurta(c.ultima) : "—") + "</td>" +
          '<td class="td-acoes"><button class="btn btn--ghost btn--sm" type="button" data-acao="ver" data-id="' + c.id + '">Ver</button></td>' +
        "</tr>";
      }).join("") +
      "</tbody></table></div>";
  }

  function ver(id) {
    const c = clientes.find(function (x) { return x.id === id; });
    if (!c) return;
    A.dialogo({
      titulo: c.nome,
      confirmar: "Salvar",
      corpo:
        '<div class="field"><label for="c-nome">Nome</label><input id="c-nome" name="nome" type="text" maxlength="80" value="' + A.esc(c.nome) + '"></div>' +
        '<div class="field"><label for="c-email">E-mail <span class="optional">(opcional)</span></label><input id="c-email" name="email" type="email" maxlength="120" value="' + A.esc(c.email || "") + '"></div>' +
        '<p class="muted">WhatsApp: <a href="https://wa.me/55' + c.telefone + '" target="_blank" rel="noopener">' + telefone(c.telefone) + "</a> · cliente desde " + A.dataCurta(c.criado_em) + "</p>" +
        '<span class="field-rotulo" style="margin-top:20px">Histórico</span>' +
        (c.agendamentos.length
          ? '<ul class="historico">' + c.agendamentos.map(function (a) {
              return "<li><span>" + A.esc(a.servicos ? a.servicos.nome : "Serviço") +
                "<br><small>" + A.dataCurta(a.inicio) + " às " + A.hora(a.inicio) + (a.barbeiros ? " · " + A.esc(a.barbeiros.nome) : "") + "</small></span>" +
                "<span>" + (STATUS[a.status] || a.status) + "<br><small>" + A.dinheiro(a.preco) + "</small></span></li>";
            }).join("") + "</ul>"
          : '<p class="muted">Sem agendamentos.</p>'),
      aoEnviar: function (form, fechar) {
        const v = A.valores(form);
        if (v.nome.length < 2) throw "Informe o nome.";
        return A.ok(A.db.from("clientes").update({ nome: v.nome, email: v.email || null }).eq("id", c.id).select("id"))
          .then(function () {
            fechar();
            A.aviso("Cliente atualizado.");
            carregar();
          });
      }
    });
  }

  A.modulo("clientes", { titulo: "Clientes", somenteDono: true, iniciar: iniciar, mostrar: carregar });
})();
