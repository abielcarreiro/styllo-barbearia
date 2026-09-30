/* =========================================================
   STYLLO BARBEARIA — script.js
   JavaScript puro, sem dependências.
   ========================================================= */

/* ---------- CONFIGURAÇÃO ----------
   SUBSTITUIR: número do WhatsApp só com dígitos, no formato 55 + DDD + número.
   Exemplo de formato: "5583999999999".
   Enquanto estiver vazio, os botões abrem o WhatsApp com a mensagem pronta
   e a pessoa escolhe o contato manualmente.
   Os dados do agendamento online (Supabase) ficam em config.js. */
const CONFIG = {
  whatsapp: "5583987216921"
};

(function () {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- WhatsApp ---------- */
  function waUrl(message) {
    const number = String(CONFIG.whatsapp || "").replace(/\D/g, "");
    const text = encodeURIComponent(message || "");
    return "https://wa.me/" + number + (text ? "?text=" + text : "");
  }

  document.querySelectorAll("[data-wa]").forEach(function (link) {
    link.setAttribute("href", waUrl(link.getAttribute("data-wa")));
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener");
  });

  /* ---------- Header: estado ao rolar ---------- */
  const header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Menu mobile (overlay em tela cheia) ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("menu");
  const desktopQuery = window.matchMedia("(min-width: 1024px)");

  function setMenu(open) {
    if (!toggle || !nav) return;
    body.classList.toggle("nav-open", open);
    body.classList.toggle("is-locked", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    if (open) {
      const first = nav.querySelector("a");
      if (first) first.focus();
    }
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(!body.classList.contains("nav-open"));
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", function (e) {
      if (!body.classList.contains("nav-open")) return;
      if (e.key === "Escape") {
        setMenu(false);
        toggle.focus();
        return;
      }
      if (e.key === "Tab") {
        // Mantém o foco dentro do menu aberto (botão + links)
        const focusables = [toggle].concat(Array.from(nav.querySelectorAll("a")));
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    const onBreakpoint = function (e) { if (e.matches) setMenu(false); };
    if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", onBreakpoint);
    else if (desktopQuery.addListener) desktopQuery.addListener(onBreakpoint);
  }

  /* ---------- Página ativa no menu (reforço caso falte aria-current) ---------- */
  const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-list a").forEach(function (a) {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === current) a.setAttribute("aria-current", "page");
  });

  /* ---------- Animações de entrada ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- FAQ: abre um item por vez ---------- */
  document.querySelectorAll("[data-accordion]").forEach(function (group) {
    const items = group.querySelectorAll("details");
    items.forEach(function (item) {
      item.addEventListener("toggle", function () {
        if (!item.open) return;
        items.forEach(function (other) { if (other !== item) other.open = false; });
      });
    });
  });

  /* ---------- Horários: destaca o dia de hoje ---------- */
  const today = new Date().getDay(); // 0 = domingo
  document.querySelectorAll(".hours-table tr[data-day]").forEach(function (row) {
    if (Number(row.getAttribute("data-day")) === today) row.classList.add("is-today");
  });

  /* ---------- Galeria: filtros ---------- */
  const gallery = document.querySelector("[data-gallery]");
  const filterBtns = document.querySelectorAll(".filter-btn");

  if (gallery && filterBtns.length) {
    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const filter = btn.getAttribute("data-filter");
        filterBtns.forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        gallery.querySelectorAll(".gallery-item").forEach(function (item) {
          const show = filter === "todos" || item.getAttribute("data-category") === filter;
          item.hidden = !show;
        });
        const status = document.getElementById("gallery-status");
        if (status) {
          const count = gallery.querySelectorAll(".gallery-item:not([hidden])").length;
          status.textContent = count + (count === 1 ? " foto exibida" : " fotos exibidas");
        }
      });
    });
  }

  /* ---------- Galeria: lightbox ---------- */
  const lightbox = document.getElementById("lightbox");

  if (gallery && lightbox) {
    const lbImg = lightbox.querySelector(".lightbox-img");
    const lbCaption = lightbox.querySelector(".lightbox-caption");
    const lbCounter = lightbox.querySelector(".lightbox-counter");
    const btnClose = lightbox.querySelector(".lightbox-close");
    const btnPrev = lightbox.querySelector(".lightbox-prev");
    const btnNext = lightbox.querySelector(".lightbox-next");
    let visibleItems = [];
    let index = 0;
    let lastFocus = null;

    function getVisible() {
      return Array.from(gallery.querySelectorAll(".gallery-item:not([hidden]) img"));
    }

    function show(i) {
      if (!visibleItems.length) return;
      index = (i + visibleItems.length) % visibleItems.length;
      const img = visibleItems[index];
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lbCaption.textContent = img.alt;
      lbCounter.textContent = (index + 1) + " / " + visibleItems.length;
    }

    function open(img) {
      visibleItems = getVisible();
      lastFocus = document.activeElement;
      lightbox.hidden = false;
      body.classList.add("is-locked");
      show(visibleItems.indexOf(img));
      btnClose.focus();
    }

    function close() {
      lightbox.hidden = true;
      body.classList.remove("is-locked");
      lbImg.removeAttribute("src");
      if (lastFocus) lastFocus.focus();
    }

    gallery.addEventListener("click", function (e) {
      const btn = e.target.closest(".gallery-btn");
      if (!btn) return;
      open(btn.querySelector("img"));
    });

    btnClose.addEventListener("click", close);
    btnPrev.addEventListener("click", function () { show(index - 1); });
    btnNext.addEventListener("click", function () { show(index + 1); });

    // Clique fora da imagem fecha
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) close();
    });

    document.addEventListener("keydown", function (e) {
      if (lightbox.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") show(index - 1);
      else if (e.key === "ArrowRight") show(index + 1);
      else if (e.key === "Tab") {
        const focusables = [btnClose, btnPrev, btnNext];
        const pos = focusables.indexOf(document.activeElement);
        e.preventDefault();
        const next = e.shiftKey ? pos - 1 : pos + 1;
        focusables[(next + focusables.length) % focusables.length].focus();
      }
    });

    // Swipe no mobile
    let startX = 0;
    let startY = 0;
    lightbox.addEventListener("touchstart", function (e) {
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
    }, { passive: true });
    lightbox.addEventListener("touchend", function (e) {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        show(dx < 0 ? index + 1 : index - 1);
      }
    }, { passive: true });
  }

  /* ---------- Formulários: utilitários ---------- */

  // Máscara simples: (00) 00000-0000
  function maskPhone(input) {
    input.addEventListener("input", function () {
      const d = input.value.replace(/\D/g, "").slice(0, 11);
      let out = d;
      if (d.length > 2) out = "(" + d.slice(0, 2) + ") " + d.slice(2);
      if (d.length > 7) out = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4);
      input.value = out;
    });
  }

  function setError(field, message) {
    const error = document.getElementById(field.id + "-erro");
    field.setAttribute("aria-invalid", message ? "true" : "false");
    if (error) error.textContent = message;
  }

  // checks: [[campo, mensagem de erro ou ""], ...]. Retorna true se tudo estiver válido.
  function validate(checks) {
    let firstInvalid = null;
    checks.forEach(function (check) {
      setError(check[0], check[1]);
      if (check[1] && !firstInvalid) firstInvalid = check[0];
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function validPhone(input) {
    return input.value.replace(/\D/g, "").length >= 10;
  }

  /* ---------- Formulário de contato → WhatsApp ---------- */
  const form = document.getElementById("contact-form");

  if (form) {
    const phone = form.querySelector("#telefone");
    maskPhone(phone);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const name = form.querySelector("#nome");
      const msg = form.querySelector("#mensagem");
      const status = document.getElementById("form-status");

      const ok = validate([
        [name, name.value.trim().length >= 2 ? "" : "Informe seu nome."],
        [phone, validPhone(phone) ? "" : "Informe um telefone válido com DDD."],
        [msg, msg.value.trim().length >= 3 ? "" : "Escreva sua mensagem."]
      ]);

      if (!ok) {
        status.textContent = "";
        return;
      }

      const text =
        "Olá! Meu nome é " + name.value.trim() + ".\n" +
        "Telefone: " + phone.value.trim() + "\n\n" +
        msg.value.trim();

      window.open(waUrl(text), "_blank", "noopener");
      status.textContent = "Abrindo o WhatsApp com sua mensagem…";
    });
  }

  // Utilitários usados também por agendar.js e pelo painel admin
  window.StylloUI = { maskPhone: maskPhone, setError: setError, validate: validate, validPhone: validPhone };

  /* ---------- Ano no rodapé ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  root.classList.add("js-ready");
})();
