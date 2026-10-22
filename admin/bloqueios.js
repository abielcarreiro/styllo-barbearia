/* =========================================================
   Painel: FOLGAS E BLOQUEIOS
   Folgas, feriados, almoço e compromissos. Os horários bloqueados
   somem do agendamento online (a função horarios_livres já os respeita).
   Dono bloqueia para todos ou para um barbeiro; barbeiro só para si.
   ========================================================= */
(function () {
  "use strict";
  const A = window.Admin;
  const MAX_DIAS = 120; // limite de dias numa repetição

  let secao;
  let barbeiros = [];
  let lista = [];

  function iniciar(el) {
    secao = el;
    secao.innerHTML =
      '<div class="admin-head">' +
        "<h1>Folgas</h1>" +
        '<button class="btn btn--primary btn--sm" type="button" data-acao="novo">+ Novo bloqueio</button>' +
      "</div>" +
      '<p class="dica">Folgas, feriados, almoço e compromissos. Os horários bloqueados não aparecem no agendamento online. ' +
      "Bloquear não cancela agendamentos já marcados: confira a agenda do período.</p>" +
      '<div id="bloqueios-lista"></div>';

    secao.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-acao]");
      if (!btn) return;
      if (btn.dataset.acao === "novo") novo();
      if (btn.dataset.acao === "apagar") apagar(btn.dataset.id);
    });

    A.ok(A.db.from("barbeiros").select("id, nome, ativo").order("ordem"))
      .then(function (r) { barbeiros = r; })
      .catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  function carregar() {
    A.$("#bloqueios-lista", secao).innerHTML = '<p class="muted">Carregando…</p>';
    return A.ok(A.db.from("bloqueios")
      .select("id, inicio, fim, motivo, barbeiro_id, barbeiros(nome)")
      .gte("fim", new Date().toISOString())
      .order("inicio"))
      .then(function (r) {
        lista = r;
        render();
      })
      .catch(function (err) {
        A.$("#bloqueios-lista", secao).innerHTML = '<p class="muted">' + A.esc(A.mensagemErro(err, "Não foi possível carregar os bloqueios.")) + "</p>";
      });
  }

  function podeApagar(b) {
    return A.ehDono() || (b.barbeiro_id && b.barbeiro_id === A.perfil.barbeiro_id);
  }

  // "22/10 o dia todo", "22/10 a 24/10", "22/10 12:00–13:00"
  function periodo(b) {
    const di = A.dataISO(b.inicio);
    const hi = A.hora(b.inicio);
    // Fim às 00:00 conta como fim do dia anterior
    const fimAjustado = new Date(new Date(b.fim).getTime() - 1);
    const df = A.dataISO(fimAjustado);
    const hf = A.hora(b.fim);
    if (hi === "00:00" && hf === "00:00") {
      return di === df ? A.dataCurta(di) + " · dia inteiro" : A.dataCurta(di) + " a " + A.dataCurta(df) + " · dias inteiros";
    }
    if (di === A.dataISO(b.fim)) return A.dataCurta(di) + " · " + hi + "–" + hf;
    return A.dataCurta(di) + " " + hi + " a " + A.dataCurta(A.dataISO(b.fim)) + " " + hf;
  }

  function render() {
    const el = A.$("#bloqueios-lista", secao);
    if (!lista.length) {
      el.innerHTML = '<div class="vazio"><p>Nenhum bloqueio daqui para frente.</p></div>';
      return;
    }
    el.innerHTML =
      '<div class="tabela-wrap"><table class="tabela"><thead><tr>' +
        "<th>Quando</th><th>Barbeiro</th><th>Motivo</th><th><span class=\"visually-hidden\">Ações</span></th>" +
      "</tr></thead><tbody>" +
      lista.map(function (b) {
        return (
          "<tr>" +
            '<td data-rotulo="Quando">' + A.esc(periodo(b)) + "</td>" +
            '<td data-rotulo="Barbeiro">' + (b.barbeiros ? A.esc(b.barbeiros.nome) : "Todos") + "</td>" +
            '<td data-rotulo="Motivo">' + A.esc(b.motivo || "—") + "</td>" +
            '<td class="td-acoes">' + (podeApagar(b)
              ? '<button class="btn btn--ghost btn--sm" type="button" data-acao="apagar" data-id="' + b.id + '">Apagar</button>'
              : "") + "</td>" +
          "</tr>"
        );
      }).join("") +
      "</tbody></table></div>";
  }

  function opcoesBarbeiro() {
    if (!A.ehDono()) {
      const eu = barbeiros.find(function (b) { return b.id === A.perfil.barbeiro_id; });
      return '<option value="' + A.perfil.barbeiro_id + '">' + A.esc(eu ? eu.nome : "Eu") + "</option>";
    }
    return '<option value="">Todos os barbeiros</option>' + barbeiros.filter(function (b) { return b.ativo; }).map(function (b) {
      return '<option value="' + b.id + '">' + A.esc(b.nome) + "</option>";
    }).join("");
  }

  function novo() {
    const hoje = A.hojeISO();
    A.dialogo({
      titulo: "Novo bloqueio",
      confirmar: "Bloquear",
      corpo:
        '<div class="field"><label for="k-tipo">Tipo</label><select id="k-tipo" name="tipo">' +
          '<option value="dia">Dia inteiro (folga, feriado)</option>' +
          '<option value="horario">Só um horário (almoço, compromisso)</option>' +
        "</select></div>" +
        '<div class="field-row">' +
          '<div class="field"><label for="k-de">De</label><input id="k-de" name="de" type="date" value="' + hoje + '"></div>' +
          '<div class="field"><label for="k-ate">Até</label><input id="k-ate" name="ate" type="date" value="' + hoje + '"></div>' +
        "</div>" +
        '<div class="field-row" data-horas hidden>' +
          '<div class="field"><label for="k-hi">Das</label><input id="k-hi" name="hi" type="time" value="12:00"></div>' +
          '<div class="field"><label for="k-hf">Às</label><input id="k-hf" name="hf" type="time" value="13:00"></div>' +
        "</div>" +
        '<p class="dica" data-dica-horas hidden>O horário é bloqueado em cada dia do período. Ex.: almoço das 12:00 às 13:00 de segunda a sábado.</p>' +
        '<div class="field"><label for="k-barb">Para</label><select id="k-barb" name="barbeiro">' + opcoesBarbeiro() + "</select></div>" +
        '<div class="field"><label for="k-mot">Motivo <span class="optional">(opcional)</span></label><input id="k-mot" name="motivo" type="text" maxlength="80" placeholder="Ex.: Feriado, Almoço, Folga"></div>',
      aoAbrir: function (form) {
        const atualizar = function () {
          const horario = form.tipo.value === "horario";
          A.$("[data-horas]", form).hidden = !horario;
          A.$("[data-dica-horas]", form).hidden = !horario;
        };
        form.tipo.addEventListener("change", atualizar);
        form.de.addEventListener("change", function () { if (form.ate.value < form.de.value) form.ate.value = form.de.value; });
        atualizar();
      },
      aoEnviar: function (form, fechar) {
        const v = A.valores(form);
        if (!v.de || !v.ate) throw "Informe as datas.";
        if (v.ate < v.de) throw "A data final precisa ser igual ou depois da inicial.";
        const base = { barbeiro_id: v.barbeiro || null, motivo: v.motivo || null };
        let linhas;

        if (v.tipo === "dia") {
          linhas = [Object.assign({ inicio: A.momento(v.de, "00:00"), fim: A.momento(A.addDias(v.ate, 1), "00:00") }, base)];
        } else {
          if (!v.hi || !v.hf || v.hf <= v.hi) throw "O horário final precisa ser depois do inicial.";
          linhas = [];
          for (let d = v.de; d <= v.ate; d = A.addDias(d, 1)) {
            linhas.push(Object.assign({ inicio: A.momento(d, v.hi), fim: A.momento(d, v.hf) }, base));
            if (linhas.length > MAX_DIAS) throw "Período muito longo: no máximo " + MAX_DIAS + " dias por vez.";
          }
        }

        return A.ok(A.db.from("bloqueios").insert(linhas).select("id")).then(function () {
          fechar();
          A.aviso(linhas.length > 1 ? linhas.length + " bloqueios criados." : "Bloqueio criado.");
          carregar();
        });
      }
    });
  }

  function apagar(id) {
    const b = lista.find(function (x) { return x.id === id; });
    if (!b || !window.confirm("Apagar o bloqueio de " + periodo(b) + "? O horário volta a aparecer no agendamento.")) return;
    A.ok(A.db.from("bloqueios").delete().eq("id", id).select("id"))
      .then(function (r) {
        if (!r.length) throw { code: "42501" };
        A.aviso("Bloqueio apagado.");
        carregar();
      })
      .catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  A.modulo("bloqueios", { titulo: "Folgas", iniciar: iniciar, mostrar: carregar });
})();
