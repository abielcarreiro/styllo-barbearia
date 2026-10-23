/* =========================================================
   NAVALHA NOBRE BARBEARIA — painel admin: núcleo
   Login, perfil, navegação entre seções e utilidades comuns.
   Cada seção (agenda.js, servicos.js…) se registra com Admin.modulo().
   ========================================================= */
(function () {
  "use strict";

  const cfg = window.STYLLO || {};
  const FUSO = cfg.fuso || "America/Fortaleza";
  const OFFSET = "-03:00"; // Fortaleza não tem horário de verão

  const Admin = (window.Admin = {
    db: cfg.db,
    FUSO: FUSO,
    perfil: null,
    modulos: {},
    ordem: []
  });

  /* ---------- Registro de seções ---------- */
  // def: { titulo, somenteDono, iniciar(secao), mostrar(secao) }
  Admin.modulo = function (id, def) {
    Admin.modulos[id] = def;
    Admin.ordem.push(id);
  };

  /* ---------- Utilidades ---------- */
  Admin.$ = function (sel, root) { return (root || document).querySelector(sel); };
  Admin.$$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };

  Admin.esc = function (text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  Admin.dinheiro = function (v) { return moeda.format(Number(v) || 0); };

  Admin.ehDono = function () { return Admin.perfil && Admin.perfil.papel === "dono"; };

  // Datas: "AAAA-MM-DD" no fuso da barbearia
  Admin.hojeISO = function () {
    return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  };
  Admin.addDias = function (iso, n) {
    const p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  };
  Admin.momento = function (iso, hora) { return iso + "T" + (hora || "00:00") + ":00" + OFFSET; };
  Admin.hora = function (ts) {
    return new Date(ts).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
  };
  Admin.dataISO = function (ts) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
  };
  Admin.dataCurta = function (isoOuTs) {
    const iso = isoOuTs.length === 10 ? isoOuTs : Admin.dataISO(isoOuTs);
    return iso.split("-").reverse().join("/");
  };
  Admin.dataLonga = function (iso) {
    const p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString("pt-BR", {
      timeZone: "UTC", weekday: "long", day: "2-digit", month: "long"
    });
  };

  // Mensagem de erro amigável. P0001 = mensagem escrita por nós no banco.
  Admin.mensagemErro = function (err, padrao) {
    console.error("Navalha Nobre admin:", err);
    if (err && err.code === "P0001") return err.message;
    if (err && err.code === "23505") return "Já existe um registro com esses dados.";
    if (err && err.code === "42501") return "Você não tem permissão para isso.";
    return padrao || "Não foi possível concluir. Tente novamente.";
  };

  /* ---------- Avisos rápidos (toast) ---------- */
  let toastTimer = null;
  Admin.aviso = function (msg, tipo) {
    const t = Admin.$("#toast");
    t.textContent = msg;
    t.dataset.tipo = tipo || "ok";
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 4000);
  };

  /* ---------- Diálogos ----------
     Admin.dialogo({ titulo, corpo (HTML), confirmar: "Salvar", aoEnviar(form, fechar) })
     aoEnviar pode retornar uma Promise; enquanto roda, o botão fica desabilitado. */
  Admin.dialogo = function (opcoes) {
    const d = document.createElement("dialog");
    d.className = "admin-dialog";
    d.innerHTML =
      '<form method="dialog" class="admin-dialog-form" novalidate>' +
        '<header class="admin-dialog-head"><h2>' + Admin.esc(opcoes.titulo) + "</h2>" +
        '<button type="button" class="icon-btn" data-fechar aria-label="Fechar">×</button></header>' +
        '<div class="admin-dialog-body">' + opcoes.corpo + "</div>" +
        '<p class="form-status is-error" data-status role="alert"></p>' +
        '<footer class="admin-dialog-foot">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-fechar>Cancelar</button>' +
          (opcoes.confirmar === false ? "" :
            '<button type="submit" class="btn btn--primary btn--sm">' + Admin.esc(opcoes.confirmar || "Salvar") + "</button>") +
        "</footer>" +
      "</form>";
    document.body.appendChild(d);

    const form = d.querySelector("form");
    const status = d.querySelector("[data-status]");
    const fechar = function () { d.close(); };
    d.addEventListener("close", function () { d.remove(); });
    Admin.$$("[data-fechar]", d).forEach(function (b) { b.addEventListener("click", fechar); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.textContent = "";
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      Promise.resolve()
        .then(function () { return opcoes.aoEnviar(form, fechar); })
        .catch(function (err) {
          status.textContent = typeof err === "string" ? err : Admin.mensagemErro(err);
        })
        .then(function () { btn.disabled = false; });
    });

    if (opcoes.aoAbrir) opcoes.aoAbrir(form);
    d.showModal();
    const primeiro = form.querySelector(".admin-dialog-body input, .admin-dialog-body select, .admin-dialog-body textarea");
    if (primeiro) primeiro.focus();
    return d;
  };

  // Máscara de telefone: (00) 00000-0000
  Admin.mascaraTelefone = function (input) {
    input.addEventListener("input", function () {
      const d = input.value.replace(/\D/g, "").slice(0, 11);
      let out = d;
      if (d.length > 2) out = "(" + d.slice(0, 2) + ") " + d.slice(2);
      if (d.length > 7) out = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
      input.value = out;
    });
  };

  // Lê os campos com name de um form: { nome: "..", ativo: true, ... }
  Admin.valores = function (form) {
    const v = {};
    Admin.$$("[name]", form).forEach(function (el) {
      if (el.type === "checkbox") v[el.name] = el.checked;
      else if (el.type === "radio") { if (el.checked) v[el.name] = el.value; }
      else v[el.name] = el.value.trim();
    });
    return v;
  };

  // Executa uma chamada do Supabase e lança o erro, se houver
  Admin.ok = function (promessa) {
    return promessa.then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  };

  /* ---------- Telas ---------- */
  const telas = ["tela-carregando", "tela-config", "tela-login", "tela-nova-senha", "tela-sem-acesso", "app"];
  function mostrarTela(id) {
    telas.forEach(function (t) { document.getElementById(t).hidden = t !== id; });
  }

  /* ---------- Navegação ---------- */
  const iniciados = {};

  function secoesPermitidas() {
    return Admin.ordem.filter(function (id) { return !Admin.modulos[id].somenteDono || Admin.ehDono(); });
  }

  function montarMenu() {
    Admin.$("#admin-nav").innerHTML = secoesPermitidas().map(function (id) {
      return '<a href="#' + id + '" data-ir="' + id + '">' + Admin.esc(Admin.modulos[id].titulo) + "</a>";
    }).join("");
  }

  function irPara() {
    const permitidas = secoesPermitidas();
    let id = location.hash.replace("#", "");
    if (permitidas.indexOf(id) === -1) id = permitidas[0];

    Admin.$$(".admin-secao").forEach(function (s) { s.hidden = s.dataset.secao !== id; });
    Admin.$$("#admin-nav a").forEach(function (a) {
      if (a.dataset.ir === id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    const secao = document.getElementById("secao-" + id);
    const mod = Admin.modulos[id];
    if (!iniciados[id]) {
      iniciados[id] = true;
      if (mod.iniciar) mod.iniciar(secao);
    }
    if (mod.mostrar) mod.mostrar(secao);
    document.title = mod.titulo + " | Painel Navalha Nobre";
    if (avisos.naoLidos) atualizarTitulo();
  }

  /* ---------- Aviso de novo agendamento pelo site ----------
     Confere a cada 30 s. Ao chegar: aviso na tela, som, contador no título da aba
     e notificação do navegador (se a pessoa ativou). Barbeiro só recebe os dele (RLS). */
  const avisos = { desde: null, timer: null, naoLidos: 0, audio: null, tituloBase: "" };

  function bip() {
    try {
      if (!avisos.audio) return;
      const ctx = avisos.audio;
      [0, 0.18].forEach(function (t) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.15);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.16);
      });
    } catch (e) { /* sem som */ }
  }

  function atualizarTitulo() {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = avisos.naoLidos ? "(" + avisos.naoLidos + ") " + base : base;
  }

  function conferirNovos() {
    Admin.ok(Admin.db.from("agendamentos")
      .select("id, inicio, criado_em, clientes(nome), servicos(nome)")
      .eq("origem", "site")
      .gt("criado_em", avisos.desde)
      .order("criado_em"))
      .then(function (novos) {
        if (!novos.length) return;
        avisos.desde = novos[novos.length - 1].criado_em;
        const a = novos[novos.length - 1];
        const texto = (novos.length > 1 ? novos.length + " novos agendamentos. Último: " : "Novo agendamento: ") +
          a.clientes.nome + ", " + a.servicos.nome + " em " + Admin.dataCurta(a.inicio) + " às " + Admin.hora(a.inicio);
        Admin.aviso(texto);
        bip();
        if (document.hidden) {
          avisos.naoLidos += novos.length;
          atualizarTitulo();
        }
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
          try { new Notification("Navalha Nobre · novo agendamento", { body: texto, icon: "../logo.jpg", tag: "novo-agendamento" }); } catch (e) { /* ignora */ }
        }
        document.dispatchEvent(new CustomEvent("styllo:novo-agendamento", { detail: novos }));
      })
      .catch(function () { /* tenta de novo no próximo ciclo */ });
  }

  // A barra da demonstração chama isto logo depois de simular um agendamento
  Admin.conferirNovos = function () { if (Admin.perfil && avisos.desde) conferirNovos(); };

  function iniciarAvisos() {
    // Parte do agendamento mais recente do banco (não depende do relógio do computador)
    clearInterval(avisos.timer);
    Admin.ok(Admin.db.from("agendamentos").select("criado_em").order("criado_em", { ascending: false }).limit(1))
      .then(function (r) {
        avisos.desde = r.length ? r[0].criado_em : "1970-01-01T00:00:00Z";
        avisos.timer = setInterval(conferirNovos, 30000);
      })
      .catch(function () {
        avisos.desde = new Date().toISOString();
        avisos.timer = setInterval(conferirNovos, 30000);
      });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && avisos.naoLidos) {
        avisos.naoLidos = 0;
        atualizarTitulo();
      }
    });
    // O navegador só libera som depois de um clique na página
    document.addEventListener("click", function () {
      if (!avisos.audio && (window.AudioContext || window.webkitAudioContext)) {
        avisos.audio = new (window.AudioContext || window.webkitAudioContext)();
      }
    }, { once: true });

    const btn = Admin.$("#btn-avisos");
    if (!btn) return;
    if (!("Notification" in window)) { btn.hidden = true; return; }
    const marcar = function () {
      const ok = Notification.permission === "granted";
      btn.setAttribute("aria-pressed", String(ok));
      btn.textContent = ok ? "Avisos ativos" : "Ativar avisos";
      btn.title = ok
        ? "Você recebe uma notificação quando chega agendamento pelo site, mesmo com o painel em outra aba."
        : "Receber notificação quando chegar agendamento pelo site";
    };
    btn.addEventListener("click", function () {
      if (Notification.permission === "denied") {
        Admin.aviso("As notificações estão bloqueadas. Libere nas configurações do navegador (cadeado ao lado do endereço).", "erro");
        return;
      }
      Notification.requestPermission().then(function () {
        marcar();
        if (Notification.permission === "granted") Admin.aviso("Pronto! Você será avisado quando chegar um agendamento pelo site.");
      });
    });
    marcar();
  }

  /* ---------- Sessão ---------- */
  function carregarPerfil(user) {
    return Admin.ok(Admin.db.from("perfis").select("id, email, nome, papel, barbeiro_id").eq("id", user.id).maybeSingle())
      .then(function (perfil) {
        if (!perfil || perfil.papel === "pendente") {
          mostrarTela("tela-sem-acesso");
          return;
        }
        Admin.perfil = perfil;
        Admin.$("#usuario-nome").textContent = perfil.nome || perfil.email;
        montarMenu();
        mostrarTela("app");
        irPara();
        iniciarAvisos();
      });
  }

  function sair() {
    Admin.db.auth.signOut().then(function () {
      location.hash = "";
      location.reload();
    });
  }

  function iniciar() {
    const db = Admin.db;
    if (!db) {
      mostrarTela("tela-config");
      return;
    }

    Admin.$$("[data-sair]").forEach(function (b) { b.addEventListener("click", sair); });
    window.addEventListener("hashchange", function () { if (Admin.perfil) irPara(); });

    let recuperando = /type=recovery/.test(location.hash);
    db.auth.onAuthStateChange(function (evento) {
      if (evento === "PASSWORD_RECOVERY") {
        recuperando = true;
        mostrarTela("tela-nova-senha");
      }
    });

    // Login
    Admin.$("#form-login").addEventListener("submit", function (e) {
      e.preventDefault();
      const status = Admin.$("#login-status");
      const email = Admin.$("#login-email").value.trim();
      const senha = Admin.$("#login-senha").value;
      if (!email || !senha) {
        status.textContent = "Informe e-mail e senha.";
        return;
      }
      status.textContent = "Entrando…";
      db.auth.signInWithPassword({ email: email, password: senha }).then(function (res) {
        if (res.error) {
          status.textContent = "E-mail ou senha incorretos.";
          return;
        }
        status.textContent = "";
        return carregarPerfil(res.data.user);
      }).catch(function (err) {
        status.textContent = Admin.mensagemErro(err, "Sem conexão com o servidor.");
      });
    });

    // Esqueci a senha
    Admin.$("#btn-esqueci").addEventListener("click", function () {
      const status = Admin.$("#login-status");
      const email = Admin.$("#login-email").value.trim();
      if (!email) {
        status.textContent = "Digite seu e-mail acima e clique de novo em \"Esqueci minha senha\".";
        Admin.$("#login-email").focus();
        return;
      }
      db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(function () {
        status.textContent = "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.";
      });
    });

    // Nova senha
    Admin.$("#form-nova-senha").addEventListener("submit", function (e) {
      e.preventDefault();
      const status = Admin.$("#nova-senha-status");
      const senha = Admin.$("#nova-senha").value;
      if (senha.length < 8) {
        status.textContent = "A senha precisa ter pelo menos 8 caracteres.";
        return;
      }
      db.auth.updateUser({ password: senha }).then(function (res) {
        if (res.error) throw res.error;
        recuperando = false;
        history.replaceState(null, "", location.pathname);
        return carregarPerfil(res.data.user);
      }).catch(function (err) {
        status.textContent = Admin.mensagemErro(err, "Não foi possível salvar a senha.");
      });
    });

    db.auth.getSession().then(function (res) {
      if (recuperando) {
        mostrarTela("tela-nova-senha");
        return;
      }
      const sessao = res.data && res.data.session;
      if (!sessao) {
        mostrarTela("tela-login");
        return;
      }
      return carregarPerfil(sessao.user);
    }).catch(function (err) {
      console.error(err);
      mostrarTela("tela-login");
    });
  }

  document.addEventListener("DOMContentLoaded", iniciar);
})();
