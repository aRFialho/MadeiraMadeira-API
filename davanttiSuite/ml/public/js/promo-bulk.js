// =============================================================
// Base path helper (supports deployments under /ml)
// =============================================================
(function initBasePath(){
  if (typeof window === 'undefined') return;
  if (window.__ML_BASE_PATH != null) return;
  const p = window.location && window.location.pathname ? window.location.pathname : '';
  window.__ML_BASE_PATH = (p === '/ml' || p.startsWith('/ml/')) ? '/ml' : '';
})();

function withBase(path) {
  const base = (typeof window !== 'undefined' && window.__ML_BASE_PATH) ? window.__ML_BASE_PATH : '';
  if (!path || typeof path !== 'string') return path;
  if (!base) return path;
  if (path === base || path.startsWith(base + '/')) return path;
  if (path.startsWith('/')) return base + path;
  return path;
}

// promo-bulk.js
// Controle de seleção em massa + integração com JobsPanel + criação de jobs locais
//
// Depende de:
//   - criar-promocao.js expor window.aplicarUnico(mlb, {silent})
//   - (opcional) remover em massa via /api/promocoes/jobs/remove
//
// API exposta:
//   window.PromoBulk = {
//     setContext({ promotion_id, promotion_type, filtroParticipacao, maxDesc, mlbFilter }),
//     onHeaderToggle(checked),
//     setAccountContext({ key, label })
//   };

(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const ui = {
    wrap: null,
    btnSel: null,
    btnApp: null,
    btnRem: null,
    selBar: null,
    selMsg: null,
    selAllCampaignBtn: null,
    selApplyBtn: null,
    selRemoveBtn: null,
    delayInput: null,
    dryRunToggle: null,
  };

  const ctx = {
    promotion_id: null,
    promotion_type: null,
    filtros: { status: "all", maxDesc: null, mlb: null },
    headerChecked: false,

    // seleção global (toda campanha filtrada)
    global: {
      selectedAll: false,
      token: null,
      total: 0,
      ids: null, // <-- usado no fallback local
    },

    account: {
      key: null,
      label: null,
    },

    // novo estado de "preparando seleção"
    isPreparingSelection: false,
  };

  /* ====================== Mensagem de "seleção preparada" ====================== */

  function showPreparedMessage(total) {
    const selBar = document.getElementById("selectionBar");
    const selMsg = document.getElementById("selMsg");
    if (!selBar || !selMsg) return;

    selBar.classList.remove("hidden");
    const original = selMsg.textContent;

    selMsg.textContent =
      `Seleção preparada: ${total} anúncio${total === 1 ? "" : "s"} ` +
      `filtrado${total === 1 ? "" : "s"} na campanha.`;

    // volta ao texto anterior depois de alguns segundos
    setTimeout(() => {
      selMsg.textContent = original;
    }, 4000);
  }

  /* ====================== Helpers ====================== */

  function countVisible() {
    return $$('#tbody input[type="checkbox"][data-mlb]').length;
  }

  function countSelected() {
    return $$('#tbody input[type="checkbox"][data-mlb]:checked').length;
  }

  function getSelectedMLBs() {
    return $$('#tbody input[type="checkbox"][data-mlb]:checked').map(
      (x) => x.dataset.mlb
    );
  }

  function getAllPageMLBs() {
    return $$('#tbody input[type="checkbox"][data-mlb]').map(
      (x) => x.dataset.mlb
    );
  }

  function getCampanhaNome() {
    return (
      document.getElementById("campName")?.textContent || "Campanha"
    ).trim();
  }

  function getDelayMs() {
    if (!ui.delayInput) return 900;
    const v = Number(String(ui.delayInput.value || "").replace(",", "."));
    if (Number.isNaN(v) || v < 0) return 900;
    return v;
  }

  function getDryRun() {
    return !!(ui.dryRunToggle && ui.dryRunToggle.checked);
  }

  function ensureUI() {
    if (!ui.wrap) {
      ui.wrap = document.getElementById("bulkControls");
      ui.btnSel = document.getElementById("bulkSelectAllBtn");
      ui.btnApp = document.getElementById("bulkApplyAllBtn");
      ui.btnRem = document.getElementById("bulkRemoveAllBtn");

      if (ui.btnSel) ui.btnSel.addEventListener("click", onSelectAllPage);
      if (ui.btnApp) ui.btnApp.addEventListener("click", onApplyPageBtn);
      if (ui.btnRem) ui.btnRem.addEventListener("click", onRemovePageBtn);
    }

    if (!ui.selBar) {
      ui.selBar = document.getElementById("selectionBar");
      ui.selMsg = document.getElementById("selMsg");
      ui.selAllCampaignBtn = document.getElementById("selAllCampaignBtn");
      ui.selApplyBtn = document.getElementById("selApplyBtn");
      ui.selRemoveBtn = document.getElementById("selRemoveBtn");
      ui.delayInput = document.getElementById("bulkDelayMs");
      ui.dryRunToggle = document.getElementById("dryRunToggle");

      if (ui.selAllCampaignBtn)
        ui.selAllCampaignBtn.addEventListener("click", onSelectWholeCampaign);
      if (ui.selApplyBtn)
        ui.selApplyBtn.addEventListener("click", onApplyClick);
      if (ui.selRemoveBtn)
        ui.selRemoveBtn.addEventListener("click", onRemoveClick);
    }
  }

  /* ============ Controle de loading da seleção por campanha ============ */

  function setPreparingSelection(isOn) {
    ensureUI();
    ctx.isPreparingSelection = !!isOn;

    // desabilita botões da barra de seleção
    if (ui.selAllCampaignBtn) {
      ui.selAllCampaignBtn.disabled = isOn;
      if (isOn) {
        ui.selAllCampaignBtn.classList.add("is-loading");
      } else {
        ui.selAllCampaignBtn.classList.remove("is-loading");
      }
    }
    if (ui.selApplyBtn) ui.selApplyBtn.disabled = isOn;
    if (ui.selRemoveBtn) ui.selRemoveBtn.disabled = isOn;

    // desabilita checkboxes da tabela (header + linhas)
    $$('#tbody input[type="checkbox"][data-mlb]').forEach((ch) => {
      ch.disabled = isOn;
    });
    const headerChk =
      document.querySelector("#checkAll") ||
      document.querySelector(
        'input[type="checkbox"][data-role="select-all"]'
      ) ||
      document.querySelector("#chkSelectAll");
    if (headerChk) headerChk.disabled = isOn;

    // mensagem amigável na faixa
    if (ui.selBar && ui.selMsg) {
      if (isOn) {
        ui.selBar.classList.remove("hidden");
        ui.selBar.classList.add("is-loading");
        ui.selMsg.textContent =
          "Preparando seleção da campanha (coletando itens filtrados)… " +
          "Em campanhas grandes isso pode levar alguns segundos.";
      } else {
        ui.selBar.classList.remove("is-loading");
        // o texto normal será recalculado pelo updateSelectionBar()
        updateSelectionBar();
      }
    }
  }

  /* ====================== Jobs helpers ====================== */

  function noteLocalJobStart(title) {
    try {
      const id = window.JobsPanel?.addLocalJob?.({
        title,
        accountKey: ctx.account.key,
        accountLabel: ctx.account.label,
      });
      window.JobsPanel?.show?.();
      return id || null;
    } catch {
      return null;
    }
  }

  function updateLocalJobProgress(id, progress, state) {
    if (!id || !window.JobsPanel?.updateLocalJob) return;
    window.JobsPanel.updateLocalJob(id, { progress, state });
  }

  /* ====================== Render / UI ====================== */

  function renderTopControls() {
    ensureUI();
    if (!ui.wrap || !ui.btnSel) return;

    const total = countVisible();
    if (!ctx.headerChecked || total === 0) {
      ui.wrap.classList.add("hidden");
    } else {
      ui.wrap.classList.remove("hidden");
      ui.btnSel.textContent = `Selecionar todos (${total} exibidos)`;
      ui.btnApp.disabled = false;
      ui.btnRem.disabled = false;
    }
  }

  function updateSelectionBar() {
    ensureUI();
    if (!ui.selBar || !ui.selMsg) return;

    // se está preparando seleção, não mexe no texto/labels aqui
    if (ctx.isPreparingSelection) {
      ui.selBar.classList.remove("hidden");
      return;
    }

    const pageSel = countSelected();
    const isGlobal = !!ctx.global.selectedAll;
    const globTotal = Number(ctx.global.total || 0);

    let msg = "";
    if (pageSel > 0) {
      msg =
        `${pageSel} anúncio${pageSel > 1 ? "s" : ""} ` +
        `selecionado${pageSel > 1 ? "s" : ""} nesta página`;
    }
    if (isGlobal) {
      const tail = "(filtrados na campanha)";
      msg = msg
        ? `${msg} • toda a campanha: ${globTotal} selecionado${
            globTotal === 1 ? "" : "s"
          } ${tail}`
        : `Toda a campanha: ${globTotal} selecionado${
            globTotal === 1 ? "" : "s"
          } ${tail}`;
    }

    ui.selMsg.textContent = msg || "Nenhum item selecionado.";

    if (pageSel > 0 || isGlobal) ui.selBar.classList.remove("hidden");
    else ui.selBar.classList.add("hidden");

    if (ui.selAllCampaignBtn) {
      if (isGlobal) {
        ui.selAllCampaignBtn.textContent = `Selecionando toda a campanha (${globTotal} filtrados)`;
        ui.selAllCampaignBtn.classList.add("danger");
      } else {
        ui.selAllCampaignBtn.textContent =
          "Selecionar toda a campanha (filtrados)";
        ui.selAllCampaignBtn.classList.remove("danger");
      }
    }

    const nothing = pageSel === 0 && !isGlobal;
    if (ui.selApplyBtn) ui.selApplyBtn.disabled = nothing;
    if (ui.selRemoveBtn) ui.selRemoveBtn.disabled = nothing;
  }

  function render() {
    renderTopControls();
    updateSelectionBar();
  }

  /* ====================== Seleções ====================== */

  function onSelectAllPage() {
    $$('#tbody input[type="checkbox"][data-mlb]').forEach((ch) => {
      ch.checked = true;
    });
    render();
  }

  // Helper para mapear status interno -> status da API de seleção
  function mapStatusForPrepare(v) {
    if (v === "started" || v === "candidate" || v === "scheduled") return v;
    if (v === "yes") return "started";
    if (v === "non") return "candidate";
    if (v === "prog") return "scheduled";
    return null; // all
  }

  // Fallback local se /selection/prepare não existir ou retornar total suspeito
  // - tenta window.coletarTodosIdsFiltrados()
  // - se não existir, usa MLBs da página atual
  async function fallbackLocalSelection() {
    const selBar = document.getElementById("selectionBar");
    const selMsg = document.getElementById("selMsg");
    if (selBar && selMsg) {
      selBar.classList.remove("hidden");
      selMsg.textContent =
        "Preparando seleção da campanha (coletando itens filtrados)…";
    }

    // 1) Se houver helper global, usa ele
    if (typeof window.coletarTodosIdsFiltrados === "function") {
      try {
        const ids = await window.coletarTodosIdsFiltrados();
        if (Array.isArray(ids) && ids.length) {
          return { token: null, total: ids.length, ids };
        }
      } catch (e) {
        console.warn("coletarTodosIdsFiltrados falhou:", e);
      }
    }

    // 2) Último recurso: só o que está na página atual
    const ids = getAllPageMLBs();
    if (ids.length) {
      alert(
        "Endpoint /selection/prepare indisponível ou sem retorno válido. Usando fallback local com os itens atualmente exibidos."
      );
      return { token: null, total: ids.length, ids };
    }

    alert(
      "Não foi possível preparar a seleção da campanha (nem endpoint nem fallback local)."
    );
    return null;
  }

  async function prepareWholeCampaign() {
    if (!ctx.promotion_id || !ctx.promotion_type) {
      alert("Selecione uma campanha antes de usar a seleção da campanha toda.");
      return null;
    }

    try {
      const maxDesc =
        ctx.filtros.maxDesc == null || ctx.filtros.maxDesc === ""
          ? null
          : Number(ctx.filtros.maxDesc);

      const body = {
        promotion_id: ctx.promotion_id,
        promotion_type: ctx.promotion_type,
        status: mapStatusForPrepare(ctx.filtros.status), // 'started' | 'candidate' | 'scheduled' | null
        mlb: ctx.filtros.mlb || null,

        // envia nos dois campos para ser compatível com o back
        percent_max: maxDesc,
        discount_max: maxDesc,
      };

      const r = await fetch(withBase("/api/promocoes/selection/prepare"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      // Se o endpoint não existe (404/405) -> fallback local
      if (r.status === 404 || r.status === 405) {
        console.warn(
          "selection/prepare não encontrado, usando fallback local."
        );
        return await fallbackLocalSelection();
      }

      const js = await r.json().catch(() => ({}));
      if (!r.ok || js.ok === false) {
        console.warn(
          "selection/prepare respondeu erro, usando fallback local.",
          js
        );
        return await fallbackLocalSelection();
      }

      // ids opcionalmente enviados pelo back quando não há store/token
      const idsFromApi = Array.isArray(js.ids)
        ? js.ids.map((v) => String(v)).filter(Boolean)
        : null;

      let total = 0;
      if (js.total != null && !Number.isNaN(Number(js.total))) {
        total = Number(js.total);
      } else if (idsFromApi && idsFromApi.length) {
        total = idsFromApi.length;
      }

      // se veio total=0, sem ids, mas a tela tem itens → suspeito -> fallback
      if (
        total === 0 &&
        (!idsFromApi || !idsFromApi.length) &&
        countVisible() > 0
      ) {
        console.warn(
          "selection/prepare retornou total=0 sem ids, com itens visíveis. Usando fallback local."
        );
        const fb = await fallbackLocalSelection();
        if (fb) return fb;
      }

      // Se tiver token, preferimos token (store avançada)
      if (js.token) {
        return {
          token: js.token,
          total,
          ids: null,
        };
      }

      // Sem token, mas com ids → usamos ids como seleção global em memória
      if (idsFromApi && idsFromApi.length) {
        return {
          token: null,
          total,
          ids: idsFromApi,
        };
      }

      // Nenhum dos dois? Último recurso: fallback local
      console.warn(
        "selection/prepare não retornou token nem ids. Usando fallback local."
      );
      const fb = await fallbackLocalSelection();
      if (fb) return fb;

      // fallback de segurança
      return {
        token: null,
        total,
        ids: null,
      };
    } catch (e) {
      console.error("prepareWholeCampaign falhou, usando fallback local:", e);
      return await fallbackLocalSelection();
    }
  }

  async function onSelectWholeCampaign() {
    // se já estava em modo "toda campanha", o clique desliga
    if (ctx.global.selectedAll && !ctx.isPreparingSelection) {
      ctx.global.selectedAll = false;
      ctx.global.token = null;
      ctx.global.total = 0;
      ctx.global.ids = null;
      render();
      return;
    }

    // evita duplo clique enquanto prepara
    if (ctx.isPreparingSelection) return;

    setPreparingSelection(true);
    let prep = null;

    try {
      prep = await prepareWholeCampaign();
    } finally {
      setPreparingSelection(false);
    }

    if (!prep) return;

    ctx.global.selectedAll = true;
    ctx.global.token = prep.token;
    ctx.global.total = prep.total;
    ctx.global.ids = prep.ids || null;

    render();
    showPreparedMessage(ctx.global.total);
  }

  /* ====================== Fila local (apply 1 a 1) ====================== */

  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  async function applyQueue(ids) {
    if (!Array.isArray(ids) || !ids.length) return;

    if (
      String(ctx.promotion_type || "").toUpperCase() ===
      "PRICE_MATCHING_MELI_ALL"
    ) {
      alert(
        "Esta campanha (PRICE_MATCHING_MELI_ALL) é 100% gerida pelo ML. Aplicação manual indisponível."
      );
      return;
    }

    const delayMs = getDelayMs();
    const camp = getCampanhaNome();
    const jobId = noteLocalJobStart(
      `Aplicação – ${camp} (${ids.length} itens)`
    );

    let done = 0;
    let ok = 0;
    let err = 0;

    if (typeof window.aplicarUnico !== "function") {
      alert("Função aplicarUnico não encontrada (criar-promocao.js).");
      if (jobId) updateLocalJobProgress(jobId, 0, "erro ao iniciar");
      return;
    }

    for (const mlb of ids) {
      try {
        const res = await window.aplicarUnico(mlb, { silent: true });
        if (res) ok++;
        else err++;
      } catch (e) {
        console.warn("Falha ao aplicar item", mlb, e);
        err++;
      }
      done++;
      const pct = Math.round((done / ids.length) * 100);
      if (jobId) {
        updateLocalJobProgress(
          jobId,
          pct,
          `processando ${done}/${ids.length}…`
        );
      }
      if (delayMs > 0 && done < ids.length) {
        await sleep(delayMs);
      }
    }

    if (jobId) {
      updateLocalJobProgress(
        jobId,
        100,
        `concluído: ${ok} ok, ${err} erro${err === 1 ? "" : "s"}`
      );
    }
  }

  /* ====================== Ações (Aplicar / Remover) ====================== */

  async function onApplyClick() {
    // 🔹 NOVO: se está em modo "toda campanha" e o criar-promocao.js
    // expôs aplicarTodosFiltrados(), delegamos pra ele.
    // Ele já sabe ler filtros de status, % e MLB e usa /apply-bulk
    // ou fallback navegando todas as páginas.
    if (
      ctx.global.selectedAll &&
      typeof window.aplicarTodosFiltrados === "function"
    ) {
      await window.aplicarTodosFiltrados();
      return;
    }

    // Cenário 1 (legado): toda campanha via token -> tenta job massivo
    if (ctx.global.selectedAll && ctx.global.token) {
      try {
        const body = {
          token: ctx.global.token,
          action: "apply",
          values: {
            dryRun: getDryRun(),
          },
        };
        const r = await fetch(withBase("/api/promocoes/jobs/apply-mass"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        const js = await r.json().catch(() => ({}));
        if (!r.ok || js.ok === false) {
          throw new Error(js.error || `HTTP ${r.status}`);
        }

        const camp = getCampanhaNome();
        const qtd = Number(ctx.global.total || 0);
        noteLocalJobStart(`Aplicação (job) – ${camp} (${qtd} itens)`);
        window.JobsPanel?.show?.();
        window.__JobsWatcher?.start?.();
        return;
      } catch (e) {
        console.error(
          "apply-mass falhou, usando fallback de IDs locais se disponível:",
          e
        );
      }
    }

    // Cenário 2: toda campanha via ids em memória (fallback local)
    if (
      ctx.global.selectedAll &&
      Array.isArray(ctx.global.ids) &&
      ctx.global.ids.length
    ) {
      await applyQueue(ctx.global.ids);
      render();
      return;
    }

    // Cenário 3: apenas selecionados da página
    const mlbs = getSelectedMLBs();
    if (!mlbs.length) {
      alert("Selecione ao menos um item na tabela.");
      return;
    }
    await applyQueue(mlbs);
    render();
  }

  async function onRemoveClick() {
    // 🔹 NOVO opcional: se você criar removerTodosFiltrados() no criar-promocao.js,
    // dá pra delegar a remoção da campanha inteira por lá também.
    if (
      ctx.global.selectedAll &&
      typeof window.removerTodosFiltrados === "function"
    ) {
      await window.removerTodosFiltrados();
      return;
    }

    // Cenário 1: toda campanha via token
    if (ctx.global.selectedAll && ctx.global.token) {
      try {
        const body = {
          token: ctx.global.token,
          action: "remove",
        };
        const r = await fetch(withBase("/api/promocoes/jobs/apply-mass"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        const js = await r.json().catch(() => ({}));
        if (!r.ok || js.ok === false) {
          throw new Error(js.error || `HTTP ${r.status}`);
        }

        const camp = getCampanhaNome();
        const qtd = Number(ctx.global.total || 0);
        noteLocalJobStart(`Remoção (job) – ${camp} (${qtd} itens)`);
        window.JobsPanel?.show?.();
        window.__JobsWatcher?.start?.();
        return;
      } catch (e) {
        console.error(
          "apply-mass/remove falhou, tentando fallback de IDs locais se houver:",
          e
        );
      }
    }

    // Cenário 2: ids locais (fallback da campanha inteira)
    if (
      ctx.global.selectedAll &&
      Array.isArray(ctx.global.ids) &&
      ctx.global.ids.length
    ) {
      try {
        const r = await fetch(withBase("/api/promocoes/jobs/remove"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ items: ctx.global.ids, delay_ms: 250 }),
        });
        const js = await r.json().catch(() => ({}));
        if (!r.ok || js.ok === false) {
          throw new Error(js.error || `HTTP ${r.status}`);
        }

        const camp = getCampanhaNome();
        const qtd = ctx.global.ids.length;
        noteLocalJobStart(`Remoção – ${camp} (${qtd} itens)`);
        window.JobsPanel?.show?.();
        window.__JobsWatcher?.start?.();
        return;
      } catch (e) {
        console.error("Erro ao iniciar remoção em massa com IDs locais:", e);
        alert("Erro ao iniciar remoção em massa da campanha (fallback local).");
        return;
      }
    }

    // Cenário 3: apenas selecionados da página
    const mlbs = getSelectedMLBs();
    if (!mlbs.length) {
      alert("Selecione ao menos um item na tabela.");
      return;
    }

    try {
      const r = await fetch(withBase("/api/promocoes/jobs/remove"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ items: mlbs, delay_ms: 250 }),
      });
      const js = await r.json().catch(() => ({}));
      if (!r.ok || js.ok === false) {
        throw new Error(js.error || `HTTP ${r.status}`);
      }

      const camp = getCampanhaNome();
      const qtd = mlbs.length;
      noteLocalJobStart(`Remoção – ${camp} (${qtd} itens)`);
      window.JobsPanel?.show?.();
      window.__JobsWatcher?.start?.();
    } catch (e) {
      console.error("Erro ao iniciar remoção em massa (selecionados):", e);
      alert("Erro ao iniciar remoção em massa dos selecionados.");
    }
  }

  // Botões da barra superior: "Aplicar a todos" / "Remover todos" da PÁGINA atual
  async function onApplyPageBtn() {
    const mlbs = getAllPageMLBs();
    if (!mlbs.length) {
      alert("Nenhum item na página atual.");
      return;
    }
    await applyQueue(mlbs);
    render();
  }

  async function onRemovePageBtn() {
    const mlbs = getAllPageMLBs();
    if (!mlbs.length) {
      alert("Nenhum item na página atual.");
      return;
    }

    try {
      const r = await fetch(withBase("/api/promocoes/jobs/remove"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ items: mlbs, delay_ms: 250 }),
      });
      const js = await r.json().catch(() => ({}));
      if (!r.ok || js.ok === false) {
        throw new Error(js.error || `HTTP ${r.status}`);
      }

      const camp = getCampanhaNome();
      const qtd = mlbs.length;
      noteLocalJobStart(`Remoção – ${camp} (${qtd} itens)`);
      window.JobsPanel?.show?.();
      window.__JobsWatcher?.start?.();
    } catch (e) {
      console.error("Erro ao iniciar remoção em massa da página:", e);
      alert("Erro ao iniciar remoção em massa da página.");
    }
  }

  /* ====================== API Pública ====================== */

  window.PromoBulk = {
    setContext({
      promotion_id,
      promotion_type,
      filtroParticipacao,
      maxDesc,
      mlbFilter,
    }) {
      ctx.promotion_id = promotion_id;
      ctx.promotion_type = promotion_type;

      // mapeia filtro da tela -> estado interno amigável para mapStatusForPrepare
      ctx.filtros.status =
        filtroParticipacao === "yes"
          ? "yes"
          : filtroParticipacao === "non"
          ? "non"
          : filtroParticipacao === "prog"
          ? "prog"
          : "all";

      ctx.filtros.maxDesc =
        maxDesc == null || maxDesc === "" ? null : Number(maxDesc);
      ctx.filtros.mlb = (mlbFilter || "").trim() || null;

      // se os filtros mudam, cancelamos seleção global
      ctx.global.selectedAll = false;
      ctx.global.token = null;
      ctx.global.total = 0;
      ctx.global.ids = null;

      render();
    },

    onHeaderToggle(checked) {
      ctx.headerChecked = !!checked;
      render();
    },

    setAccountContext(acc) {
      ctx.account.key = acc?.key || null;
      ctx.account.label = acc?.label || null;
    },
  };

  // Atualiza seleção quando os checkboxes da tabela mudarem
  document.addEventListener("change", (ev) => {
    if (ev.target?.matches?.('#tbody input[type="checkbox"][data-mlb]')) {
      render();
    }
  });

  // Re-render ao trocar linhas da tabela
  document.addEventListener("DOMContentLoaded", () => {
    ensureUI();
    render();
    const tbody = document.getElementById("tbody");
    if (tbody && "MutationObserver" in window) {
      const obs = new MutationObserver(() => render());
      obs.observe(tbody, { childList: true, subtree: false });
    }
  });
})();
