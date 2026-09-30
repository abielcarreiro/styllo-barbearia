/* =========================================================
   FINO TRATO BARBEARIA — agendar.js
   Agendamento online: lê serviços, barbeiros e horários livres do banco
   e cria o agendamento pela função criar_agendamento (supabase/schema.sql).
   ========================================================= */
(function () {
  "use strict";

  const cfg = window.STYLLO || {};
  const db = cfg.db;
  const ui = window.StylloUI;
  const FUSO = cfg.fuso || "America/Fortaleza";

  const form = document.getElementById("booking-form");
  const alertBox = document.getElementById("booking-alert");
  if (!form) return;

  const el = {
    servicos: document.getElementById("lista-servicos"),
    barbeiros: document.getElementById("lista-barbeiros"),
    dias: document.getElementById("lista-dias"),
    horarios: document.getElementById("lista-horarios"),
    nome: document.getElementById("nome"),
    telefone: document.getElementById("telefone"),
    email: document.getElementById("email"),
    obs: document.getElementById("observacoes"),
    status: document.getElementById("booking-status"),
    submit: form.querySelector('button[type="submit"]'),
    resumo: document.getElementById("resumo"),
    success: document.getElementById("booking-success")
  };

  const state = {
    servicos: [],
    barbeiros: [],
    servico: null,   // objeto do serviço
    barbeiro: "",    // id ou "" (sem preferência)
    dia: null,       // "AAAA-MM-DD"
    horario: null,   // "HH:MM"
    slotsRequest: 0
  };

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    form.hidden = true;
  }

  if (!db) {
    showAlert("O agendamento online está em configuração. Enquanto isso, fale com a gente pelo WhatsApp.");
    console.warn("Fino Trato: preencha supabaseUrl e supabaseAnonKey em config.js.");
    return;
  }

  /* ---------- Utilidades ---------- */
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  function formatPrice(servico) {
    if (!(Number(servico.preco) > 0)) return "A consultar";
    return (servico.preco_a_partir ? "a partir de " : "") + money.format(Number(servico.preco));
  }

  function escapeHTML(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Data de hoje no fuso da barbearia, no formato AAAA-MM-DD
  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }

  function addDays(iso, n) {
    const p = iso.split("-").map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.toISOString().slice(0, 10);
  }

  function isoToDate(iso) {
    const p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }

  function formatDay(iso, options) {
    return isoToDate(iso).toLocaleDateString("pt-BR", Object.assign({ timeZone: "UTC" }, options));
  }

  // 30 -> "30 min", 90 -> "1h 30min"
  function formatDuracao(min) {
    if (min < 60) return min + " min";
    return Math.floor(min / 60) + "h" + (min % 60 ? " " + (min % 60) + "min" : "");
  }

  function setStatus(message, isError) {
    el.status.textContent = message || "";
    el.status.classList.toggle("is-error", Boolean(isError));
  }

  /* ---------- Carregamento inicial ---------- */
  Promise.all([
    db.from("servicos").select("id, slug, nome, categoria, descricao, duracao_min, preco, preco_a_partir").eq("ativo", true).order("ordem"),
    db.from("barbeiros").select("id, nome, especialidade").eq("ativo", true).order("ordem"),
    db.from("horarios_funcionamento").select("dia_semana, abre, fecha"),
    db.from("configuracoes").select("dias_max").single()
  ]).then(function (res) {
    const failed = res.find(function (r) { return r.error; });
    if (failed) throw failed.error;

    state.servicos = res[0].data;
    state.barbeiros = res[1].data;
    const horarios = {};
    res[2].data.forEach(function (h) { horarios[h.dia_semana] = h; });
    const diasMax = Math.min(res[3].data.dias_max || 30, 60);

    if (!state.servicos.length || !state.barbeiros.length) {
      showAlert("O agendamento online ainda não está disponível. Fale com a gente pelo WhatsApp.");
      return;
    }

    renderServicos();
    renderBarbeiros();
    renderDias(horarios, diasMax);
    applyUrlParams();
    form.hidden = false;
  }).catch(function (err) {
    console.error("Fino Trato: erro ao carregar agendamento", err);
    showAlert("Não foi possível carregar o agendamento agora. Tente novamente em instantes ou fale com a gente pelo WhatsApp.");
  });

  /* ---------- Renderização ---------- */
  // Serviços agrupados por categoria (na ordem do catálogo)
  function renderServicos() {
    let categoriaAtual = null;
    el.servicos.innerHTML = state.servicos.map(function (s) {
      const titulo = s.categoria !== categoriaAtual
        ? '<p class="choice-group">' + escapeHTML(s.categoria || "Outros") + "</p>"
        : "";
      categoriaAtual = s.categoria;
      return titulo + (
        '<label class="choice">' +
          '<input type="radio" name="servico" value="' + s.id + '">' +
          '<span class="choice-body">' +
            '<span class="choice-title">' + escapeHTML(s.nome) + "</span>" +
            '<span class="choice-meta">' + formatDuracao(s.duracao_min) + (s.descricao ? " · " + escapeHTML(s.descricao) : "") + "</span>" +
          "</span>" +
          '<span class="choice-price">' + formatPrice(s) + "</span>" +
        "</label>"
      );
    }).join("");
  }

  function renderBarbeiros() {
    const options = [{ id: "", nome: "Sem preferência", especialidade: "Primeiro barbeiro livre" }].concat(state.barbeiros);
    el.barbeiros.innerHTML = options.map(function (b) {
      return (
        '<label class="choice">' +
          '<input type="radio" name="barbeiro" value="' + b.id + '"' + (b.id === "" ? " checked" : "") + ">" +
          '<span class="choice-body">' +
            '<span class="choice-title">' + escapeHTML(b.nome) + "</span>" +
            (b.especialidade ? '<span class="choice-meta">' + escapeHTML(b.especialidade) + "</span>" : "") +
          "</span>" +
        "</label>"
      );
    }).join("");
  }

  function renderDias(horarios, diasMax) {
    const hoje = todayISO();
    let html = "";
    for (let i = 0; i <= diasMax; i++) {
      const iso = addDays(hoje, i);
      const dow = isoToDate(iso).getUTCDay();
      const aberto = horarios[dow] && horarios[dow].abre;
      const semana = i === 0 ? "Hoje" : i === 1 ? "Amanhã" : formatDay(iso, { weekday: "short" }).replace(".", "");
      html +=
        '<label class="day' + (aberto ? "" : " is-closed") + '">' +
          '<input type="radio" name="dia" value="' + iso + '"' + (aberto ? "" : " disabled") + ">" +
          '<span class="day-week">' + semana + "</span>" +
          '<span class="day-num">' + formatDay(iso, { day: "2-digit" }) + "</span>" +
          '<span class="day-month">' + (aberto ? formatDay(iso, { month: "short" }).replace(".", "") : "fechado") + "</span>" +
        "</label>";
    }
    el.dias.innerHTML = html;
  }

  function renderHorarios(lista) {
    if (!lista.length) {
      el.horarios.innerHTML = '<p class="choice-hint">Nenhum horário livre neste dia. Tente outro dia ou outro barbeiro.</p>';
      return;
    }
    el.horarios.innerHTML = lista.map(function (h) {
      return (
        '<label class="slot">' +
          '<input type="radio" name="horario" value="' + h + '"' + (h === state.horario ? " checked" : "") + ">" +
          "<span>" + h + "</span>" +
        "</label>"
      );
    }).join("");
  }

  /* ---------- Horários livres ---------- */
  function loadSlots() {
    if (!state.servico || !state.dia) {
      state.horario = null;
      el.horarios.innerHTML = '<p class="choice-hint">Escolha o serviço e o dia para ver os horários livres.</p>';
      updateSummary();
      return;
    }
    const request = ++state.slotsRequest;
    el.horarios.innerHTML = '<p class="choice-loading">Buscando horários livres…</p>';

    db.rpc("horarios_livres", {
      p_servico: state.servico.id,
      p_data: state.dia,
      p_barbeiro: state.barbeiro || null
    }).then(function (res) {
      if (request !== state.slotsRequest) return; // resposta antiga, ignora
      if (res.error) throw res.error;
      const lista = res.data.map(function (r) { return r.horario; });
      if (lista.indexOf(state.horario) === -1) state.horario = null;
      renderHorarios(lista);
      updateSummary();
    }).catch(function (err) {
      if (request !== state.slotsRequest) return;
      console.error("Fino Trato: erro ao buscar horários", err);
      el.horarios.innerHTML = '<p class="choice-hint">Não foi possível carregar os horários. Tente novamente.</p>';
    });
  }

  /* ---------- Resumo ---------- */
  function updateSummary() {
    const barbeiro = state.barbeiros.find(function (b) { return b.id === state.barbeiro; });
    if (!state.servico) {
      el.resumo.hidden = true;
      return;
    }
    el.resumo.hidden = false;
    document.getElementById("resumo-servico").textContent = state.servico.nome + " (" + formatDuracao(state.servico.duracao_min) + ")";
    document.getElementById("resumo-barbeiro").textContent = barbeiro ? barbeiro.nome : "Sem preferência";
    document.getElementById("resumo-quando").textContent = state.dia
      ? formatDay(state.dia, { weekday: "long", day: "2-digit", month: "long" }) + (state.horario ? " às " + state.horario : " (escolha o horário)")
      : "Escolha o dia";
    document.getElementById("resumo-valor").textContent = formatPrice(state.servico);
  }

  /* ---------- Pré-seleção pelos links do site ----------
     agendar.html?servico=corte&barbeiro=<id>   ou   ?barbeiro=barbeiro-1 (1º da equipe) */
  function applyUrlParams() {
    const params = new URLSearchParams(location.search);
    const slug = params.get("servico");
    const servico = state.servicos.find(function (s) { return s.slug === slug; });
    if (servico) {
      const input = form.querySelector('input[name="servico"][value="' + servico.id + '"]');
      input.checked = true;
      state.servico = servico;
      // Rola só a lista de serviços até o escolhido
      el.servicos.scrollTop = input.closest(".choice").offsetTop - el.servicos.offsetTop - 40;
    }

    let barbeiroId = params.get("barbeiro");
    const ordinal = /^barbeiro-(\d+)$/.exec(barbeiroId || "");
    if (ordinal) {
      const b = state.barbeiros[Number(ordinal[1]) - 1];
      barbeiroId = b ? b.id : null;
    }
    if (barbeiroId && state.barbeiros.some(function (b) { return b.id === barbeiroId; })) {
      form.querySelector('input[name="barbeiro"][value="' + barbeiroId + '"]').checked = true;
      state.barbeiro = barbeiroId;
    }

    // Seleciona o primeiro dia aberto
    const primeiroDia = el.dias.querySelector('input[name="dia"]:not(:disabled)');
    if (primeiroDia) {
      primeiroDia.checked = true;
      state.dia = primeiroDia.value;
    }
    loadSlots();
  }

  /* ---------- Interação ---------- */
  form.addEventListener("change", function (e) {
    const t = e.target;
    if (t.name === "servico") {
      state.servico = state.servicos.find(function (s) { return s.id === t.value; });
      choiceError("servico-erro", "");
      loadSlots();
    } else if (t.name === "barbeiro") {
      state.barbeiro = t.value;
      loadSlots();
    } else if (t.name === "dia") {
      state.dia = t.value;
      choiceError("dia-erro", "");
      loadSlots();
    } else if (t.name === "horario") {
      state.horario = t.value;
      choiceError("horario-erro", "");
      updateSummary();
    }
  });

  ui.maskPhone(el.telefone);

  // Mensagem de erro das escolhas (serviço, dia, horário)
  function choiceError(errorId, message) {
    document.getElementById(errorId).textContent = message;
    return message;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    setStatus("");

    const erroServico = choiceError("servico-erro", state.servico ? "" : "Escolha um serviço.");
    const erroDia = choiceError("dia-erro", state.dia ? "" : "Escolha um dia.");
    const erroHorario = choiceError("horario-erro", state.horario ? "" : "Escolha um horário.");
    if (erroServico || erroDia || erroHorario) {
      const alvo = erroServico ? el.servicos : erroDia ? el.dias : el.horarios;
      alvo.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const ok = ui.validate([
      [el.nome, el.nome.value.trim().length >= 2 ? "" : "Informe seu nome."],
      [el.telefone, ui.validPhone(el.telefone) ? "" : "Informe um WhatsApp válido com DDD."],
      [el.email, !el.email.value || el.email.checkValidity() ? "" : "Informe um e-mail válido ou deixe em branco."]
    ]);
    if (!ok) return;

    el.submit.disabled = true;
    setStatus("Reservando seu horário…");

    db.rpc("criar_agendamento", {
      p_servico: state.servico.id,
      p_data: state.dia,
      p_horario: state.horario,
      p_nome: el.nome.value.trim(),
      p_telefone: el.telefone.value,
      p_barbeiro: state.barbeiro || null,
      p_email: el.email.value.trim() || null,
      p_observacoes: el.obs.value.trim() || null
    }).then(function (res) {
      if (res.error) {
        const msg = res.error.message || "";
        // P0001 = mensagem escrita por nós no banco (raise exception), segura para mostrar
        setStatus(res.error.code === "P0001" ? msg : "Não foi possível concluir o agendamento. Tente novamente.", true);
        if (/disponível|reservado/i.test(msg)) loadSlots();
        return;
      }
      const r = res.data;
      document.getElementById("sucesso-detalhe").textContent =
        r.servico + " com " + r.barbeiro + " em " + r.data + " às " + r.horario + ".";
      document.getElementById("sucesso-link").href = "cancelar.html?t=" + encodeURIComponent(r.token);
      form.hidden = true;
      el.success.hidden = false;
      el.success.focus();
      el.success.scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function (err) {
      console.error("Fino Trato: erro ao agendar", err);
      setStatus("Sem conexão com o servidor. Verifique sua internet e tente novamente.", true);
    }).then(function () {
      el.submit.disabled = false;
    });
  });
})();
