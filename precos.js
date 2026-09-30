/* =========================================================
   STYLLO BARBEARIA — precos.js
   Mantém os preços do site iguais aos do painel admin.
   A página já vem com a lista escrita no HTML (bom para o Google e
   para quando o banco estiver fora do ar); se o banco responder,
   a lista e os preços são atualizados com os valores atuais.
   ========================================================= */
(function (root) {
  "use strict";

  const CLOCK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function formatValor(preco) {
    return "R$ " + Number(preco).toFixed(2).replace(".", ",");
  }

  // Texto do preço: "R$ 35,00", "a partir de R$ 70,00" ou "A consultar"
  function precoHTML(s) {
    if (!(Number(s.preco) > 0)) return "A consultar";
    return (s.preco_a_partir ? "<small>a partir de</small> " : "") + formatValor(s.preco);
  }

  // Lista agrupada por categoria, na ordem em que as categorias aparecem
  function renderLista(servicos) {
    const grupos = [];
    const porCategoria = {};
    servicos.forEach(function (s) {
      const cat = s.categoria || "Outros";
      if (!porCategoria[cat]) {
        porCategoria[cat] = [];
        grupos.push(cat);
      }
      porCategoria[cat].push(s);
    });

    return grupos.map(function (cat) {
      return (
        '<div class="service-group">\n' +
        '  <h2 class="service-group-title">' + esc(cat) + "</h2>\n" +
        '  <div class="service-list">\n' +
        porCategoria[cat].map(function (s) {
          return (
            '    <article class="service">\n' +
            '      <div class="service-body">\n' +
            '        <div class="service-head">\n' +
            '          <h3 class="service-name">' + esc(s.nome) + "</h3>\n" +
            '          <span class="service-leader" aria-hidden="true"></span>\n' +
            '          <span class="service-price">' + precoHTML(s) + "</span>\n" +
            "        </div>\n" +
            '        <span class="service-meta">' + CLOCK + " " + s.duracao_min + " min</span>\n" +
            "      </div>\n" +
            '      <div class="service-foot">\n' +
            '        <a class="btn btn--primary btn--sm" href="agendar.html?servico=' + encodeURIComponent(s.slug) + '" aria-label="Agendar ' + esc(s.nome) + '">Agendar</a>\n' +
            "      </div>\n" +
            "    </article>\n"
          );
        }).join("") +
        "  </div>\n" +
        "</div>\n"
      );
    }).join("");
  }

  const api = { renderLista: renderLista, precoHTML: precoHTML };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api; // usado pelo gerador da página estática
    return;
  }
  root.StylloPrecos = api;

  /* ---------- Atualização a partir do banco ---------- */
  const cfg = root.STYLLO || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !root.fetch) return;

  const url =
    cfg.supabaseUrl.replace(/\/$/, "") +
    "/rest/v1/servicos?select=slug,nome,categoria,duracao_min,preco,preco_a_partir&ativo=eq.true&order=ordem";

  fetch(url, { headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey } })
    .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
    .then(function (servicos) {
      if (!Array.isArray(servicos) || !servicos.length) return;

      const lista = document.getElementById("servicos-lista");
      if (lista) lista.innerHTML = renderLista(servicos);

      document.querySelectorAll("[data-preco]").forEach(function (el) {
        const s = servicos.find(function (x) { return x.slug === el.getAttribute("data-preco"); });
        if (s) el.innerHTML = precoHTML(s);
      });
    })
    .catch(function (err) {
      console.warn("Styllo: usando preços do HTML (banco indisponível)", err);
    });
})(typeof window !== "undefined" ? window : globalThis);
