/* =========================================================
   NAVALHA NOBRE BARBEARIA — demo/demo-ui.js
   Só para a demonstração do portfólio:
   - barra flutuante para ir do site ao painel e simular agendamentos
   - botões de login com um clique no painel
   - tutorial que abre na primeira visita (e pelo botão "?")
   ========================================================= */
(function () {
  "use strict";

  const cfg = window.STYLLO || {};
  if (!cfg.demo || !window.DemoDB) return;

  const CHAVE_TUTORIAL = "navalha-demo:tutorial-visto";
  // Pasta raiz do site, descoberta pelo endereço deste arquivo (funciona no site e em /admin)
  const script = document.currentScript;
  const raiz = script ? script.src.replace(/demo\/demo-ui\.js(\?.*)?$/, "") : "./";
  const noPainel = /\/admin\/?(index\.html)?$/.test(location.pathname);

  const ICONES = {
    site: '<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/>',
    agendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    painel: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    simular: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M12 12v6M9 15h6"/>',
    restaurar: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>',
    fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
    tesoura: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>'
  };
  const icone = function (nome, tam) {
    return '<svg viewBox="0 0 24 24" width="' + (tam || 16) + '" height="' + (tam || 16) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[nome] + "</svg>";
  };
  const esc = function (t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };

  /* ---------- Estilos ---------- */
  const css = `
  .demo-ui, .demo-ui * { box-sizing: border-box; }
  .demo-ui { --d-bg:#0B0B0B; --d-surface:#151310; --d-line:#3E3831; --d-gold:#C9A45C; --d-text:#F3EEE4; --d-muted:#A8A094;
    font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: var(--d-text); }
  body.demo-com-barra { padding-bottom: 84px; }
  body.demo-com-barra .wa-float { bottom: 84px; }
  .demo-barra { position: fixed; left: 0; right: 0; bottom: 12px; z-index: 9000; display: flex; justify-content: center; padding: 0 12px; pointer-events: none; }
  .demo-barra nav { pointer-events: auto; display: flex; align-items: center; gap: 2px; max-width: 100%; overflow-x: auto; scrollbar-width: none;
    background: rgba(11,11,11,.95); border: 1px solid var(--d-line); border-radius: 14px; padding: 6px; box-shadow: 0 18px 40px -12px rgba(0,0,0,.7); backdrop-filter: blur(6px); }
  .demo-barra .demo-tag { padding: 0 8px; font: 700 11px/1 "Oswald", "Arial Narrow", sans-serif; letter-spacing: .12em; text-transform: uppercase; color: var(--d-gold); }
  .demo-barra a, .demo-barra button { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; cursor: pointer;
    padding: 8px 11px; border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--d-muted); transition: background .15s, color .15s; }
  .demo-barra a:hover, .demo-barra button:hover { background: rgba(255,255,255,.08); color: var(--d-text); }
  .demo-barra a[aria-current="page"] { background: var(--d-gold); color: #0B0B0B; }
  .demo-barra .demo-acao { color: var(--d-gold); }
  .demo-barra .demo-icone { padding: 8px; }
  .demo-barra a:focus-visible, .demo-barra button:focus-visible, .demo-modal button:focus-visible { outline: 2px solid var(--d-gold); outline-offset: 2px; }
  .demo-barra .demo-sep { width: 1px; height: 24px; margin: 0 4px; background: var(--d-line); flex-shrink: 0; }
  .demo-reabrir { all: unset; position: fixed; left: 16px; bottom: 16px; z-index: 9000; width: 44px; height: 44px; display: grid; place-items: center; cursor: pointer;
    border-radius: 50%; background: #0B0B0B; border: 1px solid var(--d-line); color: var(--d-gold); box-shadow: 0 10px 30px -8px rgba(0,0,0,.7); }
  @media (max-width: 640px) { .demo-barra .demo-rotulo-longo { display: none; } .demo-barra .demo-tag { display: none; } .demo-barra a, .demo-barra button { padding: 8px 9px; } }

  .demo-toast { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 9100; max-width: min(92vw, 460px); padding: 12px 16px;
    background: #151310; border: 1px solid var(--d-gold); border-radius: 10px; font-size: 14px; color: var(--d-text); box-shadow: 0 18px 40px -12px rgba(0,0,0,.7); }

  .demo-fundo { position: fixed; inset: 0; z-index: 9200; display: flex; align-items: flex-end; justify-content: center; background: rgba(0,0,0,.65); }
  @media (min-width: 640px) { .demo-fundo { align-items: center; padding: 16px; } }
  .demo-modal { width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; background: var(--d-surface); border: 1px solid var(--d-line);
    border-radius: 18px 18px 0 0; box-shadow: 0 30px 60px -12px rgba(0,0,0,.8); }
  @media (min-width: 640px) { .demo-modal { border-radius: 18px; } }
  .demo-modal header { display: flex; justify-content: space-between; gap: 12px; padding: 22px 24px 16px; border-bottom: 1px solid var(--d-line); }
  .demo-modal h2 { margin: 0; font: 600 22px/1.2 "Oswald", "Arial Narrow", sans-serif; letter-spacing: .02em; text-transform: uppercase; color: var(--d-text); }
  .demo-modal header p { margin: 6px 0 0; font-size: 14px; color: var(--d-muted); }
  .demo-modal .demo-x { all: unset; cursor: pointer; padding: 6px; border-radius: 8px; color: var(--d-muted); height: fit-content; }
  .demo-modal .demo-x:hover { color: var(--d-text); background: rgba(255,255,255,.08); }
  .demo-modal ol { list-style: none; margin: 0; padding: 18px 24px; display: grid; gap: 16px; }
  .demo-modal li { display: flex; gap: 14px; }
  .demo-modal .demo-num { flex-shrink: 0; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%;
    border: 1px solid var(--d-gold); color: var(--d-gold); font: 700 15px/1 "Oswald", sans-serif; }
  .demo-modal li b { display: block; font-size: 15px; color: var(--d-text); margin-bottom: 2px; }
  .demo-modal li span { font-size: 14px; line-height: 1.5; color: var(--d-muted); }
  .demo-modal .demo-dicas { margin: 0 24px 20px; padding: 14px 16px; border-radius: 12px; background: rgba(201,164,92,.08); border: 1px solid rgba(201,164,92,.25); font-size: 13.5px; line-height: 1.55; color: var(--d-muted); }
  .demo-modal .demo-dicas b { color: var(--d-text); }
  .demo-modal footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding: 16px 24px 22px; border-top: 1px solid var(--d-line); }
  .demo-btn { all: unset; box-sizing: border-box; cursor: pointer; padding: 11px 18px; border-radius: 8px; font-size: 14px; font-weight: 700; text-align: center; }
  .demo-btn--ouro { background: var(--d-gold); color: #0B0B0B; font-family: "Oswald", sans-serif; letter-spacing: .06em; text-transform: uppercase; }
  .demo-btn--ouro:hover { background: #DBBA78; }
  .demo-btn--linha { color: var(--d-muted); }
  .demo-btn--linha:hover { color: var(--d-text); background: rgba(255,255,255,.06); }

  .demo-acesso { margin-top: 16px; padding: 14px; border-radius: 10px; border: 1px dashed var(--d-gold); background: rgba(201,164,92,.06); text-align: left; }
  .demo-acesso p { margin: 0 0 10px; font: 700 11px/1 "Oswald", sans-serif; letter-spacing: .12em; text-transform: uppercase; color: var(--d-gold); }
  .demo-acesso button { all: unset; box-sizing: border-box; cursor: pointer; display: block; width: 100%; padding: 10px 12px; margin-top: 6px; border-radius: 8px;
    background: rgba(255,255,255,.05); color: var(--d-text); font-size: 14px; }
  .demo-acesso button:hover { background: rgba(255,255,255,.1); }
  .demo-acesso small { display: block; margin-top: 2px; font-size: 12px; color: var(--d-muted); }
  .demo-acesso .demo-aviso { display: block; margin-top: 10px; font-size: 12px; line-height: 1.5; color: var(--d-muted); }
  .demo-acesso code { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--d-gold); }
  .demo-barra[hidden], .demo-reabrir[hidden], .demo-toast[hidden] { display: none !important; }
  @media print { .demo-barra, .demo-reabrir, .demo-toast, .demo-fundo { display: none !important; } }
  `;

  /* ---------- Aviso rápido ---------- */
  let toastTimer;
  function toast(texto) {
    let el = document.querySelector(".demo-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "demo-ui demo-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = texto;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 4200);
  }

  /* ---------- Tutorial ---------- */
  const PASSOS = [
    ["Agende como cliente", "Clique em Agendar, escolha o serviço, o barbeiro e um horário livre. No fim você recebe o link para consultar ou cancelar."],
    ["Abra o painel", "Clique em Painel e entre como Dono com um clique. O agendamento que você fez aparece na agenda do dia marcado."],
    ["Atenda pela agenda", "Confirme o horário (gera a mensagem pronta para o WhatsApp), conclua o atendimento e informe o pagamento: ele cai no Caixa sozinho."],
    ["Explore o resto", "Veja o histórico de Clientes, o Caixa com comissões, edite Serviços e preços (o site muda na hora), crie Bloqueios e veja a Equipe. Entre como Barbeiro para ver o acesso restrito."]
  ];

  function abrirTutorial() {
    if (document.querySelector(".demo-fundo")) return;
    const anterior = document.activeElement;
    const fundo = document.createElement("div");
    fundo.className = "demo-ui demo-fundo";
    fundo.innerHTML =
      '<div class="demo-modal" role="dialog" aria-modal="true" aria-labelledby="demo-titulo">' +
        "<header><div>" +
          '<h2 id="demo-titulo">Como usar esta demonstração</h2>' +
          "<p>Site de barbearia com agendamento online e painel de gestão completo.</p>" +
        '</div><button class="demo-x" type="button" data-fechar aria-label="Fechar">' + icone("fechar", 20) + "</button></header>" +
        "<ol>" + PASSOS.map(function (p, i) {
          return '<li><span class="demo-num">' + (i + 1) + "</span><div><b>" + p[0] + "</b><span>" + p[1] + "</span></div></li>";
        }).join("") + "</ol>" +
        '<div class="demo-dicas">' +
          "<b>Acesso restrito:</b> o painel é só do dono e dos barbeiros, com login próprio. No sistema real, o cliente vê apenas o site e o agendamento; a barra Demo existe só para você conhecer tudo.<br><br>" +
          "<b>Simular agendamento</b> cria um agendamento de um cliente fictício, como se alguém tivesse marcado pelo site agora. " +
          "A demonstração começa vazia, e o botão ↺ apaga tudo para começar do zero. Tudo fica só no seu navegador: ninguém vê o seu teste." +
        "</div>" +
        "<footer>" +
          '<button class="demo-btn demo-btn--linha" type="button" data-fechar>Fechar</button>' +
          '<button class="demo-btn demo-btn--ouro" type="button" data-comecar>Começar agendando</button>' +
        "</footer>" +
      "</div>";
    document.body.appendChild(fundo);

    function fechar() {
      try { localStorage.setItem(CHAVE_TUTORIAL, "1"); } catch (e) { /* sem armazenamento */ }
      document.removeEventListener("keydown", tecla);
      fundo.remove();
      if (anterior && anterior.focus) anterior.focus();
    }
    function tecla(e) { if (e.key === "Escape") fechar(); }
    document.addEventListener("keydown", tecla);
    fundo.addEventListener("click", function (e) { if (e.target === fundo) fechar(); });
    fundo.querySelectorAll("[data-fechar]").forEach(function (b) { b.addEventListener("click", fechar); });
    fundo.querySelector("[data-comecar]").addEventListener("click", function () {
      fechar();
      if (!/agendar\.html$/.test(location.pathname)) location.href = raiz + "agendar.html";
    });
    fundo.querySelector("[data-comecar]").focus();
  }

  /* ---------- Barra ---------- */
  function montarBarra() {
    const atual = noPainel ? "painel" : /agendar\.html$/.test(location.pathname) ? "agendar" : /cancelar\.html$/.test(location.pathname) ? "" : "site";
    const link = function (id, href, rotulo) {
      return '<a href="' + href + '"' + (atual === id ? ' aria-current="page"' : "") + ">" + icone(id) + rotulo + "</a>";
    };
    const barra = document.createElement("div");
    barra.className = "demo-ui demo-barra";
    barra.innerHTML =
      '<nav aria-label="Telas da demonstração">' +
        '<span class="demo-tag">Demo</span>' +
        link("site", raiz + "index.html", "Site") +
        link("agendar", raiz + "agendar.html", "Agendar") +
        link("painel", raiz + "admin/", "Painel") +
        '<span class="demo-sep" aria-hidden="true"></span>' +
        '<button type="button" class="demo-acao" data-simular title="Cria um agendamento de um cliente fictício">' + icone("simular") + '<span class="demo-rotulo-longo">Simular agendamento</span></button>' +
        '<button type="button" class="demo-icone" data-restaurar title="Apagar tudo e começar do zero" aria-label="Apagar tudo e começar do zero">' + icone("restaurar") + "</button>" +
        '<button type="button" class="demo-icone" data-ajuda title="Como usar a demonstração" aria-label="Como usar a demonstração">' + icone("ajuda") + "</button>" +
        '<button type="button" class="demo-icone" data-esconder aria-label="Esconder barra da demonstração">' + icone("fechar") + "</button>" +
      "</nav>";
    document.body.appendChild(barra);
    document.body.classList.add("demo-com-barra");

    const reabrir = document.createElement("button");
    reabrir.className = "demo-ui demo-reabrir";
    reabrir.type = "button";
    reabrir.hidden = true;
    reabrir.setAttribute("aria-label", "Mostrar barra da demonstração");
    reabrir.innerHTML = icone("tesoura", 18);
    document.body.appendChild(reabrir);

    barra.querySelector("[data-esconder]").addEventListener("click", function () {
      barra.hidden = true;
      reabrir.hidden = false;
      document.body.classList.remove("demo-com-barra");
    });
    reabrir.addEventListener("click", function () {
      barra.hidden = false;
      reabrir.hidden = true;
      document.body.classList.add("demo-com-barra");
    });
    barra.querySelector("[data-ajuda]").addEventListener("click", abrirTutorial);

    barra.querySelector("[data-simular]").addEventListener("click", function () {
      try {
        const r = window.DemoDB.simularAgendamento();
        toast("Novo agendamento: " + r.cliente.split(" ")[0] + ", " + r.servico + " com " + r.barbeiro.split(" ")[0] + " em " + r.data + " às " + r.horario + ".");
        if (window.Admin && window.Admin.conferirNovos) window.Admin.conferirNovos();
      } catch (e) {
        toast(e.message || "Não foi possível simular agora.");
      }
    });

    barra.querySelector("[data-restaurar]").addEventListener("click", function () {
      if (!confirm("Apagar todos os agendamentos, clientes e lançamentos e começar do zero?")) return;
      window.DemoDB.restaurar();
      location.reload();
    });
  }

  /* ---------- Login com um clique (painel) ---------- */
  function montarAcessoRapido() {
    const form = document.getElementById("form-login");
    if (!form) return;
    const caixa = document.createElement("div");
    caixa.className = "demo-ui demo-acesso";
    caixa.innerHTML = "<p>Acesso de demonstração</p>" + window.DemoDB.contas.map(function (c, i) {
      return '<button type="button" data-conta="' + i + '">Entrar como <b>' + esc(c.rotulo) + "</b>" +
        "<small>" + esc(c.resumo) + "</small><small><code>" + esc(c.email) + " · " + esc(c.senha) + "</code></small></button>";
    }).join("") +
      '<small class="demo-aviso">No sistema real, o painel é só do dono e dos barbeiros, cada um com seu login. O cliente usa apenas o site e o agendamento.</small>';
    form.appendChild(caixa);
    caixa.addEventListener("click", function (e) {
      const b = e.target.closest("[data-conta]");
      if (!b) return;
      const c = window.DemoDB.contas[Number(b.getAttribute("data-conta"))];
      document.getElementById("login-email").value = c.email;
      document.getElementById("login-senha").value = c.senha;
      if (form.requestSubmit) form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true }));
    });
  }

  function iniciar() {
    const estilo = document.createElement("style");
    estilo.textContent = css;
    document.head.appendChild(estilo);
    montarBarra();
    montarAcessoRapido();
    let visto = false;
    try { visto = localStorage.getItem(CHAVE_TUTORIAL) === "1"; } catch (e) { /* sem armazenamento */ }
    if (!visto) abrirTutorial();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
