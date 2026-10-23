/* =========================================================
   NAVALHA NOBRE BARBEARIA — cancelar.js
   Página "Meu agendamento": consulta e cancela pelo link com token.
   ========================================================= */
(function () {
  "use strict";

  const db = (window.STYLLO || {}).db;
  const token = new URLSearchParams(location.search).get("t");
  const $ = function (id) { return document.getElementById(id); };

  const STATUS = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    concluido: "Concluído",
    cancelado: "Cancelado",
    faltou: "Não compareceu"
  };

  function showError(message) {
    $("agendamento-carregando").hidden = true;
    $("agendamento-detalhe").hidden = true;
    $("agendamento-erro").textContent = message;
    $("agendamento-erro").hidden = false;
  }

  function render(ag) {
    $("agendamento-carregando").hidden = true;
    $("agendamento-detalhe").hidden = false;
    $("ag-status").textContent = STATUS[ag.status] || ag.status;
    $("ag-status").dataset.status = ag.status;
    $("ag-servico").textContent = ag.servico;
    $("ag-barbeiro").textContent = ag.barbeiro;
    $("ag-data").textContent = ag.data;
    $("ag-horario").textContent = ag.horario;
    $("btn-cancelar").hidden = !ag.pode_cancelar;
  }

  if (!db) {
    showError("O agendamento online está em configuração. Fale com a gente pelo WhatsApp.");
    return;
  }
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    showError("Link inválido. Confira se você abriu o link completo recebido ao agendar.");
    return;
  }

  db.rpc("consultar_agendamento", { p_token: token }).then(function (res) {
    if (res.error) throw res.error;
    if (!res.data) {
      showError("Agendamento não encontrado.");
      return;
    }
    render(res.data);
  }).catch(function (err) {
    console.error("Navalha Nobre: erro ao consultar agendamento", err);
    showError("Não foi possível carregar seu agendamento agora. Tente novamente em instantes.");
  });

  $("btn-cancelar").addEventListener("click", function () {
    if (!window.confirm("Tem certeza que deseja cancelar este agendamento?")) return;
    const btn = this;
    btn.disabled = true;
    $("cancelar-status").textContent = "Cancelando…";

    db.rpc("cancelar_agendamento", { p_token: token }).then(function (res) {
      if (res.error) {
        $("cancelar-status").textContent = res.error.code === "P0001" ? res.error.message : "Não foi possível cancelar. Tente novamente.";
        return;
      }
      render(res.data);
      $("cancelar-status").textContent = "Agendamento cancelado. O horário foi liberado.";
    }).catch(function () {
      $("cancelar-status").textContent = "Sem conexão com o servidor. Tente novamente.";
    }).then(function () {
      btn.disabled = false;
    });
  });
})();
