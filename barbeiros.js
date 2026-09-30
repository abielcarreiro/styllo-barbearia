/* =========================================================
   STYLLO BARBEARIA — barbeiros.js
   Página Equipe: mostra os barbeiros ativos cadastrados no painel
   (nome, especialidade, Instagram e foto).
   ========================================================= */
(function () {
  "use strict";

  const cfg = window.STYLLO || {};
  const lista = document.getElementById("equipe-lista");
  if (!lista) return;

  const IG_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function cartao(b) {
    const primeiroNome = b.nome.split(" ")[0];
    const foto = b.foto_url
      ? '<img src="' + esc(b.foto_url) + '" alt="Foto de ' + esc(b.nome) + '" width="800" height="1000" loading="lazy" decoding="async">'
      : '<span class="team-inicial" aria-hidden="true">' + esc(b.nome.charAt(0).toUpperCase()) + "</span>";
    const ig = (b.instagram || "").replace(/^@/, "").trim();

    return (
      '<article class="team-card">' +
        '<div class="team-photo' + (b.foto_url ? "" : " team-photo--vazia") + '">' + foto + "</div>" +
        '<div class="team-body">' +
          "<h2>" + esc(b.nome) + "</h2>" +
          (b.especialidade ? '<p class="team-role">' + esc(b.especialidade) + "</p>" : "") +
          (ig
            ? '<a class="team-ig" href="https://www.instagram.com/' + encodeURIComponent(ig) + '" target="_blank" rel="noopener">' + IG_ICON + "@" + esc(ig) + "</a>"
            : '<span class="team-ig-vazio"></span>') +
          '<a class="btn btn--primary btn--block" href="agendar.html?barbeiro=' + encodeURIComponent(b.id) + '">Agendar com ' + esc(primeiroNome) + "</a>" +
        "</div>" +
      "</article>"
    );
  }

  function aviso(texto) {
    lista.innerHTML = '<p class="equipe-aviso">' + texto + "</p>";
  }

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.fetch) {
    aviso('Conheça a equipe no nosso <a href="https://www.instagram.com/styllobarbearia_" target="_blank" rel="noopener">Instagram</a>.');
    return;
  }

  const url = cfg.supabaseUrl.replace(/\/$/, "") +
    "/rest/v1/barbeiros?select=id,nome,especialidade,instagram,foto_url&ativo=eq.true&order=ordem";

  fetch(url, { headers: { apikey: cfg.supabaseAnonKey, Authorization: "Bearer " + cfg.supabaseAnonKey } })
    .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
    .then(function (barbeiros) {
      if (!barbeiros.length) {
        aviso("Em breve apresentaremos nossa equipe aqui.");
        return;
      }
      lista.innerHTML = barbeiros.map(cartao).join("");
    })
    .catch(function (err) {
      console.warn("Styllo: não foi possível carregar a equipe", err);
      aviso('Não foi possível carregar a equipe agora. Veja no nosso <a href="https://www.instagram.com/styllobarbearia_" target="_blank" rel="noopener">Instagram</a>.');
    });
})();
