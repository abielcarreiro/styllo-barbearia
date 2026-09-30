/* =========================================================
   Painel: AJUSTES (só o dono)
   Horário de funcionamento e regras do agendamento online.
   ========================================================= */
(function () {
  "use strict";
  const A = window.Admin;
  const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const ORDEM = [1, 2, 3, 4, 5, 6, 0]; // exibe de segunda a domingo
  let secao;

  function iniciar(el) {
    secao = el;
    secao.innerHTML =
      '<div class="admin-head"><h1>Ajustes</h1></div>' +
      '<form class="painel" id="form-horarios" novalidate>' +
        "<h2>Horário de funcionamento</h2>" +
        '<p class="dica">Define os horários oferecidos no agendamento online. ' +
        "Os horários escritos no rodapé do site são texto fixo: se mudar aqui, avise para atualizar lá também.</p>" +
        '<div class="horarios-grade" id="horarios-grade"></div>' +
        '<button class="btn btn--primary btn--sm" type="submit">Salvar horários</button>' +
      "</form>" +
      '<form class="painel" id="form-regras" novalidate>' +
        "<h2>Agendamento online</h2>" +
        '<div class="field-row field-row--3">' +
          '<div class="field"><label for="r-int">Intervalo entre horários</label><select id="r-int" name="intervalo_min">' +
            [10, 15, 20, 30, 45, 60].map(function (m) { return '<option value="' + m + '">' + m + " min</option>"; }).join("") +
          "</select></div>" +
          '<div class="field"><label for="r-ant">Antecedência mínima (min)</label><input id="r-ant" name="antecedencia_min" type="number" min="0" step="15"></div>' +
          '<div class="field"><label for="r-dias">Agendar até (dias à frente)</label><input id="r-dias" name="dias_max" type="number" min="1" max="365" step="1"></div>' +
        "</div>" +
        '<p class="dica">Ex.: intervalo de 30 min oferece 09:00, 09:30, 10:00… Antecedência de 60 min impede agendar para daqui a menos de 1 hora.</p>' +
        '<button class="btn btn--primary btn--sm" type="submit">Salvar regras</button>' +
      "</form>";

    A.$("#form-horarios", secao).addEventListener("submit", salvarHorarios);
    A.$("#form-regras", secao).addEventListener("submit", salvarRegras);
    A.$("#horarios-grade", secao).addEventListener("change", function (e) {
      if (e.target.matches("[data-aberto]")) {
        const linha = e.target.closest(".horario-linha");
        A.$$("input[type=time]", linha).forEach(function (i) { i.disabled = !e.target.checked; });
      }
    });
  }

  function carregar() {
    return Promise.all([
      A.ok(A.db.from("horarios_funcionamento").select("*")),
      A.ok(A.db.from("configuracoes").select("*").eq("id", 1).single())
    ]).then(function (r) {
      const porDia = {};
      r[0].forEach(function (h) { porDia[h.dia_semana] = h; });
      A.$("#horarios-grade", secao).innerHTML = ORDEM.map(function (d) {
        const h = porDia[d] || {};
        const aberto = !!h.abre;
        return (
          '<div class="horario-linha" data-dia="' + d + '">' +
            '<label class="check"><input type="checkbox" data-aberto' + (aberto ? " checked" : "") + "> " + DIAS[d] + "</label>" +
            '<label class="visually-hidden" for="abre-' + d + '">Abre ' + DIAS[d] + "</label>" +
            '<input class="input-sm" type="time" id="abre-' + d + '" data-abre value="' + (h.abre ? h.abre.slice(0, 5) : "09:00") + '"' + (aberto ? "" : " disabled") + ">" +
            '<span class="muted">às</span>' +
            '<label class="visually-hidden" for="fecha-' + d + '">Fecha ' + DIAS[d] + "</label>" +
            '<input class="input-sm" type="time" id="fecha-' + d + '" data-fecha value="' + (h.fecha ? h.fecha.slice(0, 5) : "19:00") + '"' + (aberto ? "" : " disabled") + ">" +
          "</div>"
        );
      }).join("");

      const c = r[1];
      const f = A.$("#form-regras", secao);
      f.intervalo_min.value = String(c.intervalo_min);
      f.antecedencia_min.value = c.antecedencia_min;
      f.dias_max.value = c.dias_max;
    }).catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  function salvarHorarios(e) {
    e.preventDefault();
    const linhas = A.$$(".horario-linha", secao).map(function (l) {
      const aberto = A.$("[data-aberto]", l).checked;
      return {
        dia_semana: Number(l.dataset.dia),
        abre: aberto ? A.$("[data-abre]", l).value : null,
        fecha: aberto ? A.$("[data-fecha]", l).value : null
      };
    });
    const invalida = linhas.find(function (h) { return h.abre && (!h.fecha || h.fecha <= h.abre); });
    if (invalida) {
      A.aviso(DIAS[invalida.dia_semana] + ": o horário de fechar precisa ser depois do de abrir.", "erro");
      return;
    }
    A.ok(A.db.from("horarios_funcionamento").upsert(linhas).select("dia_semana"))
      .then(function () { A.aviso("Horários salvos."); })
      .catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  function salvarRegras(e) {
    e.preventDefault();
    const v = A.valores(e.target);
    const dados = {
      intervalo_min: parseInt(v.intervalo_min, 10),
      antecedencia_min: parseInt(v.antecedencia_min, 10),
      dias_max: parseInt(v.dias_max, 10)
    };
    if (!(dados.antecedencia_min >= 0)) return A.aviso("Informe a antecedência mínima.", "erro");
    if (!(dados.dias_max >= 1 && dados.dias_max <= 365)) return A.aviso("Dias à frente: entre 1 e 365.", "erro");
    A.ok(A.db.from("configuracoes").update(dados).eq("id", 1).select("id"))
      .then(function () { A.aviso("Regras salvas."); })
      .catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  A.modulo("ajustes", { titulo: "Ajustes", somenteDono: true, iniciar: iniciar, mostrar: carregar });
})();
