/* =========================================================
   Painel: SERVIÇOS E PREÇOS (só o dono)
   O site público lê este catálogo: mudou aqui, mudou no site.
   ========================================================= */
(function () {
  "use strict";
  const A = window.Admin;
  let secao;
  let lista = [];

  function iniciar(el) {
    secao = el;
    secao.innerHTML =
      '<div class="admin-head">' +
        "<h1>Serviços e preços</h1>" +
        '<button class="btn btn--primary btn--sm" type="button" data-acao="novo">+ Novo serviço</button>' +
      "</div>" +
      '<p class="dica">Os preços e durações daqui aparecem no site e no agendamento online. ' +
      "Serviços desativados somem do site, mas continuam no histórico.</p>" +
      '<div id="servicos-tabela"></div>';

    secao.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-acao]");
      if (!btn) return;
      if (btn.dataset.acao === "novo") editar(null);
      if (btn.dataset.acao === "editar") editar(lista.find(function (s) { return s.id === btn.dataset.id; }));
    });
    secao.addEventListener("change", function (e) {
      if (e.target.matches("[data-ativo]")) alternarAtivo(e.target.dataset.ativo, e.target.checked, e.target);
    });
  }

  function carregar() {
    return A.ok(A.db.from("servicos").select("*").order("ordem"))
      .then(function (dados) {
        lista = dados;
        render();
      })
      .catch(function (err) {
        A.$("#servicos-tabela", secao).innerHTML = '<p class="muted">' + A.esc(A.mensagemErro(err)) + "</p>";
      });
  }

  function precoTexto(s) {
    return (s.preco_a_partir ? "a partir de " : "") + A.dinheiro(s.preco);
  }

  function render() {
    const categorias = [];
    lista.forEach(function (s) { if (categorias.indexOf(s.categoria) === -1) categorias.push(s.categoria); });

    A.$("#servicos-tabela", secao).innerHTML = categorias.map(function (cat) {
      return (
        '<h2 class="grupo-titulo">' + A.esc(cat) + "</h2>" +
        '<div class="tabela-wrap"><table class="tabela tabela--fixa">' +
          "<thead><tr><th>Serviço</th><th>Duração</th><th>Preço</th><th>No site</th><th><span class=\"visually-hidden\">Ações</span></th></tr></thead><tbody>" +
          lista.filter(function (s) { return s.categoria === cat; }).map(function (s) {
            return (
              "<tr" + (s.ativo ? "" : ' class="linha-inativa"') + ">" +
                '<td data-rotulo="Serviço">' + A.esc(s.nome) + "</td>" +
                '<td data-rotulo="Duração">' + s.duracao_min + " min</td>" +
                '<td data-rotulo="Preço">' + precoTexto(s) + "</td>" +
                '<td data-rotulo="No site"><label class="switch"><input type="checkbox" data-ativo="' + s.id + '"' + (s.ativo ? " checked" : "") +
                  ' aria-label="Mostrar ' + A.esc(s.nome) + ' no site"><span></span></label></td>' +
                '<td class="td-acoes"><button class="btn btn--ghost btn--sm" type="button" data-acao="editar" data-id="' + s.id + '">Editar</button></td>' +
              "</tr>"
            );
          }).join("") +
        "</tbody></table></div>"
      );
    }).join("") || '<div class="vazio"><p>Nenhum serviço cadastrado.</p></div>';
  }

  function alternarAtivo(id, ativo, input) {
    A.ok(A.db.from("servicos").update({ ativo: ativo }).eq("id", id).select("id"))
      .then(function () {
        const s = lista.find(function (x) { return x.id === id; });
        s.ativo = ativo;
        render();
        A.aviso(ativo ? "Serviço visível no site." : "Serviço escondido do site.");
      })
      .catch(function (err) {
        input.checked = !ativo;
        A.aviso(A.mensagemErro(err), "erro");
      });
  }

  // "Corte + Barba" -> "corte-barba"
  function slugDe(nome) {
    return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "servico";
  }

  function slugUnico(nome) {
    const base = slugDe(nome);
    let slug = base;
    let n = 2;
    while (lista.some(function (s) { return s.slug === slug; })) slug = base + "-" + n++;
    return slug;
  }

  function editar(s) {
    const novo = !s;
    s = s || { nome: "", categoria: "", duracao_min: 30, preco: 0, preco_a_partir: false, ativo: true, ordem: (lista.length ? lista[lista.length - 1].ordem + 1 : 1) };
    const categorias = [];
    lista.forEach(function (x) { if (categorias.indexOf(x.categoria) === -1) categorias.push(x.categoria); });

    A.dialogo({
      titulo: novo ? "Novo serviço" : "Editar serviço",
      corpo:
        '<div class="field"><label for="s-nome">Nome</label><input id="s-nome" name="nome" type="text" maxlength="80" value="' + A.esc(s.nome) + '"></div>' +
        '<div class="field"><label for="s-cat">Categoria</label><input id="s-cat" name="categoria" type="text" list="s-cats" maxlength="40" value="' + A.esc(s.categoria) + '">' +
          '<datalist id="s-cats">' + categorias.map(function (c) { return '<option value="' + A.esc(c) + '">'; }).join("") + "</datalist></div>" +
        '<div class="field-row">' +
          '<div class="field"><label for="s-preco">Preço (R$)</label><input id="s-preco" name="preco" type="number" min="0" step="0.01" inputmode="decimal" value="' + Number(s.preco).toFixed(2) + '"></div>' +
          '<div class="field"><label for="s-dur">Duração (min)</label><input id="s-dur" name="duracao_min" type="number" min="5" max="480" step="5" value="' + s.duracao_min + '"></div>' +
        "</div>" +
        '<label class="check"><input type="checkbox" name="preco_a_partir"' + (s.preco_a_partir ? " checked" : "") + '> Mostrar como "a partir de"</label>' +
        '<label class="check"><input type="checkbox" name="ativo"' + (s.ativo ? " checked" : "") + "> Disponível no site e no agendamento</label>" +
        '<div class="field"><label for="s-ordem">Ordem na lista</label><input id="s-ordem" name="ordem" type="number" step="1" value="' + s.ordem + '"></div>',
      aoEnviar: function (form, fechar) {
        const v = A.valores(form);
        const dados = {
          nome: v.nome,
          categoria: v.categoria || "Outros",
          preco: Number(String(v.preco).replace(",", ".")),
          duracao_min: parseInt(v.duracao_min, 10),
          preco_a_partir: v.preco_a_partir,
          ativo: v.ativo,
          ordem: parseInt(v.ordem, 10) || 0
        };
        if (dados.nome.length < 2) throw "Informe o nome do serviço.";
        if (!(dados.preco >= 0)) throw "Informe um preço válido.";
        if (!(dados.duracao_min >= 5 && dados.duracao_min <= 480)) throw "A duração deve ficar entre 5 e 480 minutos.";

        // O slug (usado nos links do site) é criado uma vez e não muda
        let req;
        if (novo) {
          dados.slug = slugUnico(dados.nome);
          req = A.db.from("servicos").insert(dados).select("id");
        } else {
          req = A.db.from("servicos").update(dados).eq("id", s.id).select("id");
        }
        return A.ok(req).then(function () {
          fechar();
          A.aviso(novo ? "Serviço criado." : "Serviço atualizado.");
          carregar();
        });
      }
    });
  }

  A.modulo("servicos", { titulo: "Serviços", somenteDono: true, iniciar: iniciar, mostrar: carregar });
})();
