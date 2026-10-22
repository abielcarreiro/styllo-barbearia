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
              '<td data-rotulo="Barbeiro"><span class="pessoa">' +
                (b.foto_url ? '<img class="avatar" src="' + A.esc(b.foto_url) + '" alt="" width="36" height="45" loading="lazy">' : '<span class="avatar avatar--vazio" aria-hidden="true">' + A.esc(b.nome.charAt(0).toUpperCase()) + "</span>") +
                A.esc(b.nome) + "</span></td>" +
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

  /* ---------- Fotos (Supabase Storage, pasta "barbeiros") ---------- */
  const BUCKET = "barbeiros";

  // Recorta em retrato 4:5, reduz para 800x1000 e converte em JPEG
  function prepararFoto(arquivo) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) return reject("Use uma foto JPG, PNG ou WEBP.");
      if (arquivo.size > 15 * 1024 * 1024) return reject("A foto é muito grande (máximo 15 MB).");
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = function () {
        const W = 800, H = 1000;
        const iw = img.naturalWidth, ih = img.naturalHeight;
        let sw = iw, sh = ih, sx = 0, sy = 0;
        if (iw / ih > W / H) {
          sw = ih * W / H;
          sx = (iw - sw) / 2;
        } else {
          sh = iw * H / W;
          sy = (ih - sh) * 0.3; // fotos altas: prioriza a parte de cima (rosto)
        }
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject("Não foi possível processar a foto.");
        }, "image/jpeg", 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject("Não foi possível abrir essa foto. Tente outra (JPG ou PNG).");
      };
      img.src = url;
    });
  }

  // ".../object/public/barbeiros/arquivo.jpg" -> "arquivo.jpg"
  function caminhoDaFoto(url) {
    const m = /\/object\/public\/barbeiros\/([^?]+)/.exec(url || "");
    return m ? decodeURIComponent(m[1]) : null;
  }

  function apagarArquivo(url) {
    const caminho = caminhoDaFoto(url);
    if (caminho) A.db.storage.from(BUCKET).remove([caminho]).catch(function () {});
  }

  // Envia a foto nova, grava o endereço no barbeiro e apaga a antiga
  function salvarFoto(barbeiroId, blob, fotoAntiga) {
    const caminho = barbeiroId + "-" + Date.now() + ".jpg";
    return A.ok(A.db.storage.from(BUCKET).upload(caminho, blob, { contentType: "image/jpeg", cacheControl: "31536000" }))
      .then(function () {
        const url = A.db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
        return A.ok(A.db.from("barbeiros").update({ foto_url: url }).eq("id", barbeiroId).select("id"));
      })
      .then(function () { apagarArquivo(fotoAntiga); });
  }

  function editarBarbeiro(b) {
    const novo = !b;
    b = b || { nome: "", especialidade: "", instagram: "", foto_url: null, comissao_percent: 0, ativo: true, ordem: barbeiros.length + 1 };
    const foto = { nova: null, remover: false };
    A.dialogo({
      titulo: novo ? "Novo barbeiro" : "Editar barbeiro",
      corpo:
        '<div class="field"><label for="b-nome">Nome</label><input id="b-nome" name="nome" type="text" maxlength="80" value="' + A.esc(b.nome) + '"></div>' +
        '<div class="field"><label for="b-esp">Especialidade <span class="optional">(opcional)</span></label><input id="b-esp" name="especialidade" type="text" maxlength="80" value="' + A.esc(b.especialidade || "") + '"></div>' +
        '<div class="field"><label for="b-ig">Instagram <span class="optional">(opcional, sem @)</span></label><input id="b-ig" name="instagram" type="text" maxlength="60" value="' + A.esc(b.instagram || "") + '"></div>' +
        '<div class="field"><span class="field-rotulo">Foto</span>' +
          '<div class="foto-editor">' +
            '<div class="foto-preview" data-preview>' + (b.foto_url ? '<img src="' + A.esc(b.foto_url) + '" alt="">' : "<span>Sem foto</span>") + "</div>" +
            '<div class="foto-acoes">' +
              '<label class="btn btn--ghost btn--sm" for="b-foto">' + (b.foto_url ? "Trocar foto" : "Escolher foto") + "</label>" +
              '<input id="b-foto" type="file" accept="image/jpeg,image/png,image/webp" class="visually-hidden">' +
              (b.foto_url ? '<button class="link-btn" type="button" data-remover-foto>Remover foto</button>' : "") +
              '<p class="dica">A foto é recortada em formato retrato (4:5). Prefira uma foto do peito para cima.</p>' +
            "</div>" +
          "</div>" +
        "</div>" +
        '<div class="field-row">' +
          '<div class="field"><label for="b-com">Comissão (%)</label><input id="b-com" name="comissao_percent" type="number" min="0" max="100" step="0.5" inputmode="decimal" value="' + (Number(b.comissao_percent) || 0) + '"></div>' +
          '<div class="field"><label for="b-ordem">Ordem no site</label><input id="b-ordem" name="ordem" type="number" step="1" value="' + b.ordem + '"></div>' +
        "</div>" +
        '<p class="dica">A comissão aparece no Caixa e não é mostrada no site.</p>' +
        '<label class="check"><input type="checkbox" name="ativo"' + (b.ativo ? " checked" : "") + "> Ativo (aparece no agendamento)</label>",
      aoAbrir: function (form) {
        const preview = A.$("[data-preview]", form);
        const status = A.$("[data-status]", form.closest("dialog"));
        A.$("#b-foto", form).addEventListener("change", function () {
          const arquivo = this.files && this.files[0];
          if (!arquivo) return;
          status.textContent = "";
          prepararFoto(arquivo).then(function (blob) {
            foto.nova = blob;
            foto.remover = false;
            preview.innerHTML = '<img src="' + URL.createObjectURL(blob) + '" alt="">';
          }).catch(function (msg) {
            status.textContent = msg;
          });
        });
        const remover = A.$("[data-remover-foto]", form);
        if (remover) remover.addEventListener("click", function () {
          foto.nova = null;
          foto.remover = true;
          preview.innerHTML = "<span>Sem foto</span>";
        });
      },
      aoEnviar: function (form, fechar) {
        const v = A.valores(form);
        const dados = {
          nome: v.nome,
          especialidade: v.especialidade || null,
          instagram: v.instagram.replace(/^@/, "") || null,
          ordem: parseInt(v.ordem, 10) || 0,
          comissao_percent: Number(String(v.comissao_percent).replace(",", ".")) || 0,
          ativo: v.ativo
        };
        if (dados.nome.length < 2) throw "Informe o nome.";
        if (dados.comissao_percent < 0 || dados.comissao_percent > 100) throw "A comissão deve ficar entre 0 e 100%.";
        const req = novo
          ? A.db.from("barbeiros").insert(dados).select("id")
          : A.db.from("barbeiros").update(dados).eq("id", b.id).select("id");
        return A.ok(req).then(function (linhas) {
          const id = novo ? linhas[0].id : b.id;
          if (foto.nova) return salvarFoto(id, foto.nova, b.foto_url);
          if (foto.remover) {
            return A.ok(A.db.from("barbeiros").update({ foto_url: null }).eq("id", id).select("id"))
              .then(function () { apagarArquivo(b.foto_url); });
          }
        }).then(function () {
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
