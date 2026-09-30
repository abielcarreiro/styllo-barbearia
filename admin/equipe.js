/* =========================================================
   Painel: EQUIPE E ACESSOS (só o dono)
   Barbeiros (aparecem no agendamento) e quem pode entrar no painel.
   ========================================================= */
(function () {
  "use strict";
  const A = window.Admin;
  let secao;
  let barbeiros = [];
  let perfis = [];

  const PAPEIS = { dono: "Dono (acesso total)", barbeiro: "Barbeiro (própria agenda)", pendente: "Sem acesso" };

  function iniciar(el) {
    secao = el;
    secao.innerHTML =
      '<div class="admin-head">' +
        "<h1>Equipe</h1>" +
        '<button class="btn btn--primary btn--sm" type="button" data-acao="novo">+ Novo barbeiro</button>' +
      "</div>" +
      '<div id="equipe-barbeiros"></div>' +
      '<div class="admin-head admin-head--sub"><h2>Acessos ao painel</h2></div>' +
      '<div class="dica dica--caixa">' +
        "<p><strong>Para dar acesso a alguém:</strong></p>" +
        "<ol>" +
          "<li>No Supabase, abra <strong>Authentication &gt; Users &gt; Add user &gt; Create new user</strong>, informe o e-mail e uma senha provisória e marque <em>Auto Confirm User</em>.</li>" +
          "<li>A pessoa aparece na lista abaixo como <em>Sem acesso</em>. Clique em <strong>Editar</strong> e escolha o papel.</li>" +
          "<li>Para barbeiros, vincule ao cadastro do barbeiro: ele verá só a própria agenda.</li>" +
        "</ol>" +
        "<p>A pessoa pode trocar a senha em “Esqueci minha senha” na tela de login.</p>" +
      "</div>" +
      '<div id="equipe-acessos"></div>';

    secao.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-acao]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.acao === "novo") editarBarbeiro(null);
      if (btn.dataset.acao === "editar-barbeiro") editarBarbeiro(barbeiros.find(function (b) { return b.id === id; }));
      if (btn.dataset.acao === "editar-acesso") editarAcesso(perfis.find(function (p) { return p.id === id; }));
    });
  }

  function carregar() {
    return Promise.all([
      A.ok(A.db.from("barbeiros").select("*").order("ordem")),
      A.ok(A.db.from("perfis").select("*").order("criado_em"))
    ]).then(function (r) {
      barbeiros = r[0];
      perfis = r[1];
      renderBarbeiros();
      renderAcessos();
    }).catch(function (err) { A.aviso(A.mensagemErro(err), "erro"); });
  }

  function renderBarbeiros() {
    A.$("#equipe-barbeiros", secao).innerHTML = barbeiros.length
      ? '<div class="tabela-wrap"><table class="tabela"><thead><tr>' +
          "<th>Barbeiro</th><th>Especialidade</th><th>Situação</th><th><span class=\"visually-hidden\">Ações</span></th>" +
        "</tr></thead><tbody>" +
        barbeiros.map(function (b) {
          return (
            "<tr" + (b.ativo ? "" : ' class="linha-inativa"') + ">" +
              '<td data-rotulo="Barbeiro">' + A.esc(b.nome) + "</td>" +
              '<td data-rotulo="Especialidade">' + A.esc(b.especialidade || "—") + "</td>" +
              '<td data-rotulo="Situação">' + (b.ativo ? "Ativo" : "Inativo") + "</td>" +
              '<td class="td-acoes"><button class="btn btn--ghost btn--sm" type="button" data-acao="editar-barbeiro" data-id="' + b.id + '">Editar</button></td>' +
            "</tr>"
          );
        }).join("") + "</tbody></table></div>"
      : '<div class="vazio"><p>Nenhum barbeiro cadastrado. Cadastre a equipe para liberar o agendamento online.</p></div>';
  }

  function nomeBarbeiro(id) {
    const b = barbeiros.find(function (x) { return x.id === id; });
    return b ? b.nome : "—";
  }

  function renderAcessos() {
    A.$("#equipe-acessos", secao).innerHTML = perfis.length
      ? '<div class="tabela-wrap"><table class="tabela"><thead><tr>' +
          "<th>E-mail</th><th>Papel</th><th>Barbeiro vinculado</th><th><span class=\"visually-hidden\">Ações</span></th>" +
        "</tr></thead><tbody>" +
        perfis.map(function (p) {
          const eu = p.id === A.perfil.id;
          return (
            "<tr>" +
              '<td data-rotulo="E-mail">' + A.esc(p.email) + (eu ? ' <span class="tag">você</span>' : "") + "</td>" +
              '<td data-rotulo="Papel">' + PAPEIS[p.papel] + "</td>" +
              '<td data-rotulo="Barbeiro">' + (p.papel === "barbeiro" ? A.esc(nomeBarbeiro(p.barbeiro_id)) : "—") + "</td>" +
              '<td class="td-acoes">' + (eu ? "" :
                '<button class="btn btn--ghost btn--sm" type="button" data-acao="editar-acesso" data-id="' + p.id + '">Editar</button>') + "</td>" +
            "</tr>"
          );
        }).join("") + "</tbody></table></div>"
      : '<div class="vazio"><p>Nenhuma conta criada ainda.</p></div>';
  }

  function editarBarbeiro(b) {
    const novo = !b;
    b = b || { nome: "", especialidade: "", instagram: "", ativo: true, ordem: barbeiros.length + 1 };
    A.dialogo({
      titulo: novo ? "Novo barbeiro" : "Editar barbeiro",
      corpo:
        '<div class="field"><label for="b-nome">Nome</label><input id="b-nome" name="nome" type="text" maxlength="80" value="' + A.esc(b.nome) + '"></div>' +
        '<div class="field"><label for="b-esp">Especialidade <span class="optional">(opcional)</span></label><input id="b-esp" name="especialidade" type="text" maxlength="80" value="' + A.esc(b.especialidade || "") + '"></div>' +
        '<div class="field"><label for="b-ig">Instagram <span class="optional">(opcional, sem @)</span></label><input id="b-ig" name="instagram" type="text" maxlength="60" value="' + A.esc(b.instagram || "") + '"></div>' +
        '<div class="field"><label for="b-ordem">Ordem no site</label><input id="b-ordem" name="ordem" type="number" step="1" value="' + b.ordem + '"></div>' +
        '<label class="check"><input type="checkbox" name="ativo"' + (b.ativo ? " checked" : "") + "> Ativo (aparece no agendamento)</label>",
      aoEnviar: function (form, fechar) {
        const v = A.valores(form);
        const dados = {
          nome: v.nome,
          especialidade: v.especialidade || null,
          instagram: v.instagram.replace(/^@/, "") || null,
          ordem: parseInt(v.ordem, 10) || 0,
          ativo: v.ativo
        };
        if (dados.nome.length < 2) throw "Informe o nome.";
        const req = novo
          ? A.db.from("barbeiros").insert(dados).select("id")
          : A.db.from("barbeiros").update(dados).eq("id", b.id).select("id");
        return A.ok(req).then(function () {
          fechar();
          A.aviso(novo ? "Barbeiro cadastrado." : "Barbeiro atualizado.");
          carregar();
        });
      }
    });
  }

  function editarAcesso(p) {
    A.dialogo({
      titulo: "Acesso de " + p.email,
      corpo:
        '<div class="field"><label for="p-nome">Nome exibido</label><input id="p-nome" name="nome" type="text" maxlength="80" value="' + A.esc(p.nome || "") + '"></div>' +
        '<div class="field"><label for="p-papel">Papel</label><select id="p-papel" name="papel">' +
          Object.keys(PAPEIS).map(function (k) {
            return '<option value="' + k + '"' + (p.papel === k ? " selected" : "") + ">" + PAPEIS[k] + "</option>";
          }).join("") +
        "</select></div>" +
        '<div class="field" data-vinculo><label for="p-barb">Barbeiro vinculado</label><select id="p-barb" name="barbeiro_id">' +
          '<option value="">Selecione</option>' +
          barbeiros.map(function (b) {
            return '<option value="' + b.id + '"' + (p.barbeiro_id === b.id ? " selected" : "") + ">" + A.esc(b.nome) + "</option>";
          }).join("") +
        "</select></div>",
      aoAbrir: function (form) {
        const atualizar = function () { A.$("[data-vinculo]", form).hidden = form.papel.value !== "barbeiro"; };
        form.papel.addEventListener("change", atualizar);
        atualizar();
      },
      aoEnviar: function (form, fechar) {
        const v = A.valores(form);
        if (v.papel === "barbeiro" && !v.barbeiro_id) throw "Escolha qual barbeiro é esta pessoa.";
        if (v.papel === "dono" && !window.confirm("Dar acesso total (incluindo financeiro) para " + p.email + "?")) return;
        return A.ok(A.db.from("perfis").update({
          nome: v.nome || null,
          papel: v.papel,
          barbeiro_id: v.papel === "barbeiro" ? v.barbeiro_id : null
        }).eq("id", p.id).select("id")).then(function () {
          fechar();
          A.aviso("Acesso atualizado.");
          carregar();
        });
      }
    });
  }

  A.modulo("equipe", { titulo: "Equipe", somenteDono: true, iniciar: iniciar, mostrar: carregar });
})();
