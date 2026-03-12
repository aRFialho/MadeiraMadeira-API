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

// public/js/estrategicos.js
// Tela de Produtos Estratégicos — Preço Original → Preço Promo → % calculada (não editável)
// + Seleção por página (checkbox do header) e Seleção GLOBAL ("Selecionar todos")
// + Bulk Atualizar (sync) e Bulk Excluir
// + Validação de duplicados no front (single, massa e import CSV) + relatório final

(() => {
  "use strict";

  // =========================
  // Helpers básicos
  // =========================
  const $ = (id) => document.getElementById(id);

  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const fmtMoney = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const fmtPct = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return (
      n.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + "%"
    );
  };

  const toast = (msg) => {
    try {
      alert(msg);
    } catch {
      console.log("ALERT:", msg);
    }
  };

  // Detecta quando backend devolve HTML (redirect silencioso /login /select-conta etc)
  async function safeReadBody(resp) {
    try {
      return (await resp.text()) || "";
    } catch {
      return "";
    }
  }

  async function fetchJSON(url, options = {}) {
    const resp = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...options,
    });

    const ct = (resp.headers.get("content-type") || "").toLowerCase();

    if (!resp.ok) {
      const body = await safeReadBody(resp);
      const looksHtml =
        body.trim().startsWith("<!DOCTYPE") || body.trim().startsWith("<html");
      const msg = looksHtml
        ? `HTTP ${resp.status} em ${url} (HTML/redirect — verifique login/conta/permissão)`
        : `HTTP ${resp.status} em ${url} ${body.slice(0, 240)}`.trim();

      const err = new Error(msg);
      err.status = resp.status;
      err.body = body;
      err.url = url;

      // tenta extrair JSON de erro (quando tiver)
      if (ct.includes("application/json")) {
        try {
          const j = JSON.parse(body);
          err.json = j;
        } catch {}
      }

      throw err;
    }

    if (!ct.includes("application/json")) {
      // se não for JSON, devolve null
      return null;
    }

    try {
      return await resp.json();
    } catch {
      return null;
    }
  }

  async function fetchJSONAny(paths, options = {}) {
    let lastErr;
    for (const p of paths) {
      try {
        return await fetchJSON(p, options);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Falha em todas as rotas.");
  }

  // =========================
  // Estado
  // =========================
  let rows = []; // lista completa
  let filteredRows = []; // lista filtrada (busca MLB)

  const PAGE_SIZE = 20;
  let currentPage = 1;

  let mlbQuery = ""; // texto de busca atual

  // Seleção global
  // - selectedAll=true significa "todos estão selecionados", exceto os explicitamente removidos (excluded)
  // - selectedAll=false significa seleção por set de MLBs
  let selectedAll = false;
  const selectedMlbs = new Set(); // usado quando selectedAll=false
  const excludedMlbs = new Set(); // usado quando selectedAll=true

  // =========================
  // Util: seleção
  // =========================
  function resetSelection() {
    selectedAll = false;
    selectedMlbs.clear();
    excludedMlbs.clear();
    updateSummarySelected();
    syncSelectionUIOnPage();
  }

  function getRowMlbFromCheckbox(cb) {
    return (cb?.getAttribute?.("data-mlb") || "").trim().toUpperCase();
  }

  function isMlbSelected(mlb) {
    const m = String(mlb || "")
      .trim()
      .toUpperCase();
    if (!m) return false;
    if (selectedAll) return !excludedMlbs.has(m);
    return selectedMlbs.has(m);
  }

  function setMlbSelected(mlb, on) {
    const m = String(mlb || "")
      .trim()
      .toUpperCase();
    if (!m) return;

    if (selectedAll) {
      if (on) excludedMlbs.delete(m);
      else excludedMlbs.add(m);
    } else {
      if (on) selectedMlbs.add(m);
      else selectedMlbs.delete(m);
    }
  }

  function selectedCount() {
    if (selectedAll) {
      // se não carregou rows ainda, exibe "todos"
      const total = rows.length || 0;
      const exc = excludedMlbs.size;
      return Math.max(0, total - exc);
    }
    return selectedMlbs.size;
  }

  function updateSummarySelected() {
    const el = $("summarySelected");
    const allBadge = $("selectedAllBadge");
    const clearBtn = $("btnClearSelection");
    const selAllBtn = $("btnSelectAllGlobal");

    const total = rows.length;

    if (selectedAll) {
      if (el)
        el.textContent = `Todos (${Math.max(
          0,
          total - excludedMlbs.size
        )} selecionados)`;
      if (allBadge) {
        allBadge.hidden = false;
        allBadge.textContent = `Selecionando todos (${total})`;
      }
      if (selAllBtn) selAllBtn.disabled = true;
    } else {
      if (el) el.textContent = `${selectedMlbs.size} selecionados`;
      if (allBadge) allBadge.hidden = true;
      if (selAllBtn) selAllBtn.disabled = total === 0;
    }

    if (clearBtn) clearBtn.disabled = total === 0 || selectedCount() === 0;
  }

  function syncSelectionUIOnPage() {
    const tbody = $("tbodyStrategicos");
    const chkAllPage = $("chkSelectAllRows");
    if (!tbody) return;

    const pageChecks = Array.from(tbody.querySelectorAll(".row-select"));
    pageChecks.forEach((cb) => {
      const mlb = getRowMlbFromCheckbox(cb);
      cb.checked = isMlbSelected(mlb);
    });

    // header checkbox = seleciona/desmarca apenas a página
    if (chkAllPage) {
      const allChecked = pageChecks.length
        ? pageChecks.every((cb) => cb.checked)
        : false;
      const anyChecked = pageChecks.some((cb) => cb.checked);

      chkAllPage.checked = allChecked;
      chkAllPage.indeterminate = !allChecked && anyChecked;
    }
  }

  function getSelectedMlbsList() {
    // se selectedAll, devolve todos os mlbs carregados menos excluded
    if (selectedAll) {
      return rows
        .map((r) => String(r.mlb || "").toUpperCase())
        .filter(Boolean)
        .filter((m) => !excludedMlbs.has(m));
    }
    return Array.from(selectedMlbs);
  }

  // =========================
  // Cálculos
  // =========================
  function computePct(original, promo) {
    const o = Number(original);
    const p = Number(promo);
    if (!Number.isFinite(o) || !Number.isFinite(p) || o <= 0 || p <= 0)
      return null;
    const pct = (1 - p / o) * 100;
    if (!Number.isFinite(pct)) return null;
    return Math.round(pct * 100) / 100;
  }

  function updatePctCalcCell(tr, row) {
    if (!tr || !row) return;

    const original = row.original_price;
    const promo = row.promo_price;

    const pctCalc = computePct(original, promo);

    const pctEl = tr.querySelector(".pct-calc");
    if (pctEl) {
      if (pctCalc == null) {
        pctEl.textContent = "—";
        pctEl.classList.add("muted");
      } else {
        pctEl.textContent = fmtPct(pctCalc);
        pctEl.classList.remove("muted");
      }
    }
  }

  function computeStatusPill(row) {
    const ls = String(row.listing_status || "")
      .toLowerCase()
      .trim();
    if (ls === "active") return { label: "Ativo", cls: "status-pill--ok" };
    if (ls === "paused")
      return { label: "Pausado", cls: "status-pill--pending" };
    if (ls === "closed")
      return { label: "Encerrado", cls: "status-pill--default" };
    if (ls === "inactive")
      return { label: "Inativo", cls: "status-pill--default" };

    const s = String(row.status || "").toLowerCase();
    if (s.includes("aplicada") || s.includes("ativa"))
      return { label: "OK", cls: "status-pill--ok" };
    if (s.includes("erro") || s.includes("falha"))
      return { label: "Erro", cls: "status-pill--error" };
    if (s.includes("pendente"))
      return { label: "Pendente", cls: "status-pill--pending" };
    return { label: "—", cls: "status-pill--default" };
  }

  function applyMlbFilter() {
    const q = String(mlbQuery || "")
      .trim()
      .toUpperCase();

    if (!q) {
      filteredRows = rows.slice();
    } else {
      filteredRows = rows.filter((r) =>
        String(r.mlb || "")
          .toUpperCase()
          .includes(q)
      );
    }

    // volta pra primeira página sempre que muda o filtro
    currentPage = 1;

    // contador pequeno no input
    const cnt = $("mlbSearchCount");
    if (cnt) {
      cnt.textContent = q ? `${filteredRows.length}/${rows.length}` : "";
    }
  }

  // =========================
  // Carregar lista
  // =========================
  async function loadRows() {
    const tbody = $("tbodyStrategicos");
    const summaryTotal = $("summaryTotal");

    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="muted">Carregando produtos estratégicos...</td></tr>`;
    }

    try {
      const data = await fetchJSONAny(["/api/estrategicos"], { method: "GET" });
      rows = Array.isArray(data?.items || data) ? data.items || data : [];

      // mantém seleção consistente: remove MLBs que não existem mais
      if (!selectedAll) {
        for (const m of Array.from(selectedMlbs)) {
          if (!rows.some((r) => String(r.mlb || "").toUpperCase() === m)) {
            selectedMlbs.delete(m);
          }
        }
      } else {
        for (const m of Array.from(excludedMlbs)) {
          if (!rows.some((r) => String(r.mlb || "").toUpperCase() === m)) {
            excludedMlbs.delete(m);
          }
        }
      }

      // aplica filtro atual
      applyMlbFilter();

      renderTable();
      if (summaryTotal)
        summaryTotal.textContent = `${filteredRows.length} itens`;
      updateSummarySelected();
    } catch (err) {
      console.error("loadRows:", err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" class="muted">Erro ao carregar: ${escapeHtml(
          err.message
        )}</td></tr>`;
      }
      filteredRows = [];
      renderPagination();
      updateSummarySelected();
    }
  }

  // =========================
  // Paginação
  // =========================
  function renderPagination() {
    const container = $("strategicPagination");
    if (!container) return;

    const base = filteredRows || [];
    const totalPages = Math.max(1, Math.ceil(base.length / PAGE_SIZE));

    if (totalPages <= 1) {
      container.innerHTML = "";
      return;
    }
    if (currentPage > totalPages) currentPage = totalPages;

    const maxButtons = 9;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    let html = `
    <button type="button" class="pg-btn pg-prev" data-page="prev" ${
      currentPage === 1 ? "disabled" : ""
    }>&laquo;</button>
  `;

    if (start > 1) {
      html += `<button type="button" class="pg-btn pg-num" data-page="1">1</button>`;
      if (start > 2) html += `<span class="pg-ellipsis">…</span>`;
    }

    for (let p = start; p <= end; p++) {
      html += `<button type="button" class="pg-btn pg-num ${
        p === currentPage ? "is-active" : ""
      }" data-page="${p}">${p}</button>`;
    }

    if (end < totalPages) {
      if (end < totalPages - 1) html += `<span class="pg-ellipsis">…</span>`;
      html += `<button type="button" class="pg-btn pg-num" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `
    <button type="button" class="pg-btn pg-next" data-page="next" ${
      currentPage === totalPages ? "disabled" : ""
    }>&raquo;</button>
  `;

    container.innerHTML = html;
  }

  // =========================
  // Render tabela
  // =========================
  function renderTable() {
    const tbody = $("tbodyStrategicos");
    const summaryTotal = $("summaryTotal");
    if (!tbody) return;

    const base = filteredRows || [];

    if (!base.length) {
      tbody.innerHTML = `
      <tr>
        <td colspan="9" class="muted">
          ${
            (mlbQuery || "").trim()
              ? `Nenhum item encontrado para a busca <strong>${escapeHtml(
                  mlbQuery
                )}</strong>.`
              : `Nenhum produto estratégico cadastrado. Use <strong>“Adicionar item”</strong> ou
                 <strong>“Atualizar por arquivo”</strong>.`
          }
        </td>
      </tr>
    `;
      if (summaryTotal) summaryTotal.textContent = `${base.length} itens`;
      renderPagination();
      updateSummarySelected();
      syncSelectionUIOnPage();
      return;
    }

    const totalPages = Math.max(1, Math.ceil(base.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageRows = base.slice(startIdx, startIdx + PAGE_SIZE);

    tbody.innerHTML = pageRows
      .map((row) => {
        const mlb = String(row.mlb || "").toUpperCase();
        const id = row.id != null ? String(row.id) : "";
        const name = row.name || "";
        const original = row.original_price;
        const promo = row.promo_price;

        const pctCalc = computePct(original, promo);
        const pill = computeStatusPill(row);

        return `
        <tr data-mlb="${escapeHtml(mlb)}" data-id="${escapeHtml(id)}">
          <td class="col-check">
            <input type="checkbox" class="row-select" data-mlb="${escapeHtml(
              mlb
            )}">
          </td>

          <td class="col-mlb">
            <span class="mlb-label">${escapeHtml(mlb)}</span>
          </td>

          <td class="col-name">
            <div class="name-readonly" title="${escapeHtml(name)}">${escapeHtml(
          name || "—"
        )}</div>
          </td>

          <td class="col-money">
            <span class="money-readonly">${fmtMoney(original)}</span>
          </td>

          <td class="col-money">
            <input
              type="number"
              class="input-money"
              data-field="promo_price"
              min="0"
              step="0.01"
              value="${promo != null ? promo : ""}"
              placeholder="ex.: 199.90"
            >
            <div class="cell-hint muted">Preço final desejado</div>
          </td>

          <td class="col-percent">
            <span class="pct-calc ${pctCalc == null ? "muted" : ""}">
              ${pctCalc == null ? "—" : fmtPct(pctCalc)}
            </span>
            <div class="cell-hint muted">% calculada</div>
          </td>

          <td class="col-percent">
            <span class="pct-applied ${
              row.percent_applied == null ? "muted" : ""
            }">
              ${row.percent_applied == null ? "—" : fmtPct(row.percent_applied)}
            </span>
            <div class="cell-hint muted">% atual no ML</div>
          </td>

          <td class="col-status">
            <span class="status-pill ${pill.cls}">${escapeHtml(
          pill.label
        )}</span>
          </td>

          <td class="col-actions">
            <button type="button" class="btn-xs btn-outline" data-action="save-row" title="Salvar preço promo">
              💾 Salvar
            </button>
            <button type="button" class="btn-xs btn-outline" data-action="sync-row" title="Atualizar do ML (nome/status/preço original/promo atual)">
              🔄 Atualizar
            </button>
            <button type="button" class="btn-xs btn-danger" data-action="delete-row" title="Remover">
              🗑️
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    if (summaryTotal) summaryTotal.textContent = `${base.length} itens`;

    renderPagination();
    updateSummarySelected();
    syncSelectionUIOnPage();
  }

  // =========================
  // CRUD linha
  // =========================
  async function saveRow(idOrMlb) {
    const row =
      rows.find((r) => String(r.id) === String(idOrMlb)) ||
      rows.find(
        (r) => String(r.mlb).toUpperCase() === String(idOrMlb).toUpperCase()
      );

    if (!row) return;

    const payload = { promo_price: row.promo_price ?? null };

    try {
      if (row.id != null) {
        await fetchJSON(
          `/api/estrategicos/${encodeURIComponent(String(row.id))}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );
        toast(`✅ Salvo: ${row.mlb}`);
        await loadRows();
        return;
      }

      // fallback
      await fetchJSON("/api/estrategicos", {
        method: "POST",
        body: JSON.stringify({ mlb: row.mlb, ...payload }),
      });

      toast(`✅ Salvo: ${row.mlb}`);
      await loadRows();
    } catch (err) {
      console.error("saveRow:", err);
      toast(`❌ Erro ao salvar ${row.mlb}: ${err.message}`);
    }
  }

  async function syncRow(idOrMlb) {
    const row =
      rows.find((r) => String(r.id) === String(idOrMlb)) ||
      rows.find(
        (r) =>
          String(r.mlb || "").toUpperCase() ===
          String(idOrMlb || "").toUpperCase()
      );

    if (!row) {
      console.warn("[syncRow] row não encontrada para:", idOrMlb);
      return;
    }

    const mlb = String(row.mlb || "")
      .trim()
      .toUpperCase();
    const id = row.id != null ? String(row.id).trim() : "";

    const candidates = [
      mlb ? `/api/estrategicos/${encodeURIComponent(mlb)}/sync` : null,
      id ? `/api/estrategicos/id/${encodeURIComponent(id)}/sync` : null,
    ].filter(Boolean);

    if (!candidates.length) {
      console.warn("[syncRow] sem mlb/id válidos:", row);
      return;
    }

    try {
      console.log("[syncRow] tentando:", candidates);
      const data = await fetchJSONAny(candidates, { method: "POST" });
      console.log("[syncRow] sucesso:", data);

      toast(`✅ Atualizado do ML: ${mlb || `ID ${id}`}`);
      await loadRows();
    } catch (err) {
      // 🔥 aqui fica explícito o que veio do backend
      console.error("[syncRow] falhou:", {
        tried: candidates,
        status: err?.status,
        url: err?.url,
        json: err?.json,
        body: err?.body,
        message: err?.message,
      });

      const backendMsg =
        err?.json?.error || err?.json?.message || err?.json?.details || "";
      toast(
        `❌ Erro ao atualizar ${mlb || `ID ${id}`}: ${
          backendMsg || err.message
        }`
      );
    }
  }

  async function deleteRow(mlb) {
    if (
      !confirm(
        `Deseja realmente remover o MLB ${mlb} da lista de estratégicos?`
      )
    )
      return;

    try {
      await fetchJSON(`/api/estrategicos/${encodeURIComponent(mlb)}`, {
        method: "DELETE",
      });

      // remove também da seleção
      const m = String(mlb).toUpperCase();
      if (!selectedAll) selectedMlbs.delete(m);
      else excludedMlbs.delete(m);

      rows = rows.filter((r) => String(r.mlb).toUpperCase() !== m);
      renderTable();
    } catch (err) {
      console.error("deleteRow:", err);
      toast(`❌ Erro ao remover ${mlb}: ${err.message}`);
    }
  }

  // =========================
  // Apply
  // =========================
  async function handleApplySelected() {
    const selected = getSelectedMlbsList();
    if (!selected.length) {
      toast("Selecione ao menos um item.");
      return;
    }

    const promotionTypeSel = $("promotionType");
    const type = promotionTypeSel ? promotionTypeSel.value : "DEAL";

    const items = [];
    const skipped = {
      noRow: 0,
      noPromo: 0,
      invalidPct: 0,
    };

    for (const mlb of selected) {
      const row = rows.find(
        (r) => String(r.mlb).toUpperCase() === String(mlb).toUpperCase()
      );
      if (!row) {
        skipped.noRow += 1;
        continue;
      }

      const promo = row.promo_price;
      if (
        promo == null ||
        promo === "" ||
        !Number.isFinite(Number(promo)) ||
        Number(promo) <= 0
      ) {
        skipped.noPromo += 1;
        continue;
      }

      const pctCalc = computePct(row.original_price, promo);

      // Regras mínimas para evitar aplicar lixo
      // - pctCalc precisa existir
      // - precisa ser > 0 (promo menor que original)
      // - precisa ser < 100
      if (!Number.isFinite(Number(pctCalc)) || pctCalc <= 0 || pctCalc >= 100) {
        skipped.invalidPct += 1;
        continue;
      }

      items.push({
        mlb: String(mlb).toUpperCase(),
        promo_price: Number(promo), // mantém compatibilidade
        percent_calc: Number(pctCalc), // NOVO: aplicar usando % calculada
      });
    }

    if (!items.length) {
      let msg = "Nenhum item válido para aplicar.\n";
      if (skipped.noPromo) msg += `• ${skipped.noPromo} sem Preço Promo\n`;
      if (skipped.invalidPct)
        msg += `• ${skipped.invalidPct} com % inválida (promo >= original ou valores ruins)\n`;
      toast(msg.trim());
      return;
    }

    const extra =
      skipped.noPromo || skipped.invalidPct || skipped.noRow
        ? `\n\nIgnorados:\n${
            skipped.noPromo ? `• ${skipped.noPromo} sem Preço Promo\n` : ""
          }${
            skipped.invalidPct ? `• ${skipped.invalidPct} com % inválida\n` : ""
          }${skipped.noRow ? `• ${skipped.noRow} não encontrados\n` : ""}`
        : "";

    if (
      !confirm(
        `Confirmar aplicação para ${items.length} itens (tipo ${type}) usando a % calculada?${extra}`
      )
    )
      return;

    try {
      await fetchJSON("/api/estrategicos/apply", {
        method: "POST",
        body: JSON.stringify({
          items,
          promotion_type: type,
          // dica pro backend (opcional; se você não usar, pode ignorar)
          apply_mode: "PERCENT_CALC",
        }),
      });

      toast("✅ Promoções enviadas para processamento.");
      await loadRows();
    } catch (err) {
      console.error("handleApplySelected:", err);
      toast(`❌ Erro ao aplicar promoções: ${err.message}`);
    }
  }

  // =========================
  // Upload CSV: mlb;promo_price
  // + duplicado no front (já existe no rows)
  // + duplicado dentro do arquivo (mesmo mlb repetido)
  // =========================
  function parseCsvToItems(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    let startIndex = 0;
    const header = lines[0].toLowerCase();
    if (
      header.includes("mlb") &&
      (header.includes("promo") || header.includes("preco"))
    )
      startIndex = 1;

    const items = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(/[,;]+/g).map((p) => p.trim());
      if (!parts[0]) continue;

      const mlb = parts[0].toUpperCase();
      const promo =
        parts[1] != null && parts[1] !== ""
          ? Number(String(parts[1]).replace(",", "."))
          : null;

      items.push({ mlb, promo_price: Number.isNaN(promo) ? null : promo });
    }
    return items;
  }

  async function handleUploadProcess() {
    const fileInput = $("fileStrategicos");
    const chkRemove = $("chkRemoveMissing");
    const uploadStatus = $("uploadStatus");

    if (!fileInput || !fileInput.files || !fileInput.files.length) {
      toast("Selecione um arquivo primeiro.");
      return;
    }

    const file = fileInput.files[0];
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv")) {
      toast("Por enquanto, só aceito CSV (mlb;promo_price).");
      return;
    }

    if (uploadStatus) uploadStatus.textContent = "Lendo arquivo...";

    try {
      const text = await file.text();
      const rawItems = parseCsvToItems(text);

      if (!rawItems.length) {
        toast("Nenhuma linha válida encontrada no arquivo.");
        if (uploadStatus)
          uploadStatus.textContent = "Nenhum dado válido encontrado.";
        return;
      }

      const existingSet = new Set(
        rows.map((r) => String(r.mlb || "").toUpperCase()).filter(Boolean)
      );

      const seen = new Set();
      const duplicatedInFile = [];
      const skippedAlreadyExists = [];

      const filtered = [];
      for (const it of rawItems) {
        const mlb = String(it.mlb || "").toUpperCase();
        if (!mlb) continue;

        if (seen.has(mlb)) {
          duplicatedInFile.push(mlb);
          continue;
        }
        seen.add(mlb);

        if (existingSet.has(mlb)) {
          skippedAlreadyExists.push(mlb);
          continue;
        }

        filtered.push(it);
      }

      if (!filtered.length) {
        const msgParts = [];
        if (skippedAlreadyExists.length)
          msgParts.push(
            `Já existem: ${skippedAlreadyExists.slice(0, 10).join(", ")}${
              skippedAlreadyExists.length > 10 ? "…" : ""
            }`
          );
        if (duplicatedInFile.length)
          msgParts.push(
            `Duplicados no arquivo: ${duplicatedInFile
              .slice(0, 10)
              .join(", ")}${duplicatedInFile.length > 10 ? "…" : ""}`
          );

        toast(`Nenhum item novo para importar.\n${msgParts.join("\n")}`.trim());
        if (uploadStatus)
          uploadStatus.textContent = "Nada para importar (apenas duplicados).";
        return;
      }

      if (uploadStatus)
        uploadStatus.textContent = `Enviando ${filtered.length} itens...`;

      const resp = await fetchJSON("/api/estrategicos/replace", {
        method: "POST",
        body: JSON.stringify({
          items: filtered,
          remove_missing: !!(chkRemove && chkRemove.checked),
        }),
      });

      // backend pode devolver report.skipped_existing (por concorrência/outro user)
      const backSkipped = resp?.report?.skipped_existing || [];

      const reportLines = [];
      if (skippedAlreadyExists.length) {
        reportLines.push(
          `• ${
            skippedAlreadyExists.length
          } MLB(s) não inseridos (já existiam): ${skippedAlreadyExists
            .slice(0, 10)
            .join(", ")}${skippedAlreadyExists.length > 10 ? "…" : ""}`
        );
      }
      if (duplicatedInFile.length) {
        reportLines.push(
          `• ${
            duplicatedInFile.length
          } MLB(s) ignorados (duplicados no arquivo): ${duplicatedInFile
            .slice(0, 10)
            .join(", ")}${duplicatedInFile.length > 10 ? "…" : ""}`
        );
      }
      if (backSkipped.length) {
        reportLines.push(
          `• ${
            backSkipped.length
          } MLB(s) não inseridos (já existiam no backend): ${backSkipped
            .slice(0, 10)
            .join(", ")}${backSkipped.length > 10 ? "…" : ""}`
        );
      }

      toast(
        `✅ Importação finalizada.\nItens enviados: ${filtered.length}\n${
          reportLines.length ? "\n" + reportLines.join("\n") : ""
        }`.trim()
      );

      if (uploadStatus)
        uploadStatus.textContent = "Lista atualizada com sucesso.";
      await loadRows();
    } catch (err) {
      console.error("handleUploadProcess:", err);
      toast(`❌ Erro ao processar arquivo: ${err.message}`);
      if (uploadStatus) uploadStatus.textContent = `Erro: ${err.message}`;
    }
  }

  // =========================
  // Bulk Delete
  // =========================
  async function handleDeleteSelected() {
    const selected = getSelectedMlbsList();
    if (!selected.length)
      return toast("Selecione ao menos um item para excluir.");

    const useAll = selectedAll;

    if (useAll) {
      // Excluir todos (respeitando excluídos) -> vamos mandar MLBS explicitamente para segurança
      if (
        !confirm(
          `Você está em modo “Selecionar todos”. Remover TODOS os itens selecionados (${selected.length})?`
        )
      )
        return;
    } else {
      if (!confirm(`Remover ${selected.length} item(ns) da lista?`)) return;
    }

    try {
      // Se selecionou todos, manda mlbs[] (mais seguro que all=true)
      const resp = await fetchJSON("/api/estrategicos/bulk/delete", {
        method: "POST",
        body: JSON.stringify({
          mlbs: selected,
        }),
      });

      toast(`✅ Removidos: ${resp?.removed ?? selected.length}`);
      resetSelection();
      await loadRows();
    } catch (e) {
      console.error("handleDeleteSelected:", e);
      toast(`❌ Erro ao excluir: ${e.message}`);
    }
  }

  // =========================
  // Bulk Sync (Atualizar Todos)
  // =========================
  async function handleSyncSelected() {
    const selected = getSelectedMlbsList();
    if (!selected.length)
      return toast("Selecione ao menos um item para atualizar.");

    const isAll = selectedAll;

    if (
      !confirm(
        `Atualizar do Mercado Livre ${selected.length} item(ns)${
          isAll ? " (modo Selecionar Todos)" : ""
        }?`
      )
    )
      return;

    const btn = $("btnSyncSelected");
    const prevTxt = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "🔄 Atualizando...";
    }

    try {
      const resp = await fetchJSON("/api/estrategicos/bulk/sync", {
        method: "POST",
        body: JSON.stringify({ mlbs: selected }),
      });

      const ok = resp?.synced_ok ?? 0;
      const err = resp?.synced_err ?? 0;

      toast(
        `✅ Atualização finalizada: ${ok} ok${err ? `, ${err} erro(s)` : ""}.`
      );
      await loadRows();
    } catch (e) {
      console.error("handleSyncSelected:", e);
      toast(`❌ Erro no Atualizar Todos: ${e.message}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevTxt || "🔄 Atualizar selecionados";
      }
    }
  }

  // =========================
  // Add MLBs (lote)
  // + valida duplicado no front
  // + backend retorna 409 se duplicado (DUPLICATE_MLB)
  // =========================
  function openAddMlbsPanel() {
    const panel = $("addMlbsPanel");
    if (!panel) return;
    panel.hidden = false;

    const textarea = $("txtAddMlbs");
    if (textarea) {
      textarea.value = "";
      textarea.focus();
    }
    const status = $("addMlbsStatus");
    if (status) status.textContent = "";
  }

  function closeAddMlbsPanel() {
    const panel = $("addMlbsPanel");
    if (panel) panel.hidden = true;

    const textarea = $("txtAddMlbs");
    if (textarea) textarea.value = "";

    const status = $("addMlbsStatus");
    if (status) status.textContent = "";
  }

  async function handleAddMlbsConfirm() {
    const textarea = $("txtAddMlbs");
    const status = $("addMlbsStatus");
    if (!textarea) return;

    const raw = (textarea.value || "")
      .split(/[\s,;]+/g)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (!raw.length) return toast("Informe ao menos um MLB.");

    // dup dentro do input
    const seen = new Set();
    const duplicatedInInput = [];
    const uniq = [];
    for (const mlb of raw) {
      if (seen.has(mlb)) duplicatedInInput.push(mlb);
      else {
        seen.add(mlb);
        uniq.push(mlb);
      }
    }

    // dup já existente na lista carregada
    const existingSet = new Set(
      rows.map((r) => String(r.mlb || "").toUpperCase()).filter(Boolean)
    );
    const alreadyExists = [];
    const toInsert = [];
    for (const mlb of uniq) {
      if (existingSet.has(mlb)) alreadyExists.push(mlb);
      else toInsert.push(mlb);
    }

    if (!toInsert.length) {
      let msg = "Nenhum MLB novo para inserir.";
      if (alreadyExists.length)
        msg += `\nJá existiam: ${alreadyExists.slice(0, 10).join(", ")}${
          alreadyExists.length > 10 ? "…" : ""
        }`;
      if (duplicatedInInput.length)
        msg += `\nDuplicados no texto: ${duplicatedInInput
          .slice(0, 10)
          .join(", ")}${duplicatedInInput.length > 10 ? "…" : ""}`;
      toast(msg);
      return;
    }

    // UI progresso opcional
    const progressWrap = $("bulkAddProgress");
    const progressFill = $("bulkAddProgressFill");
    const progressLabel = $("bulkAddProgressLabel");
    if (progressWrap && progressFill && progressLabel) {
      progressWrap.hidden = false;
      progressFill.style.width = "0%";
      progressLabel.textContent = `0 / ${toInsert.length}`;
    }

    let okCount = 0;
    let skippedBack = 0;
    let errCount = 0;
    const skippedBackList = [];

    if (status) status.textContent = `Inserindo ${toInsert.length} MLB(s)...`;

    for (let i = 0; i < toInsert.length; i++) {
      const mlb = toInsert[i];
      try {
        await fetchJSON("/api/estrategicos", {
          method: "POST",
          body: JSON.stringify({ mlb }),
        });
        okCount += 1;
      } catch (e) {
        // se backend retornar duplicate (corrida)
        const code = e?.json?.code;
        if (e.status === 409 || code === "DUPLICATE_MLB") {
          skippedBack += 1;
          skippedBackList.push(mlb);
        } else {
          errCount += 1;
          console.error("Erro ao adicionar", mlb, e);
        }
      } finally {
        if (progressFill && progressLabel) {
          const pct = ((i + 1) / toInsert.length) * 100;
          progressFill.style.width = `${pct}%`;
          progressLabel.textContent = `${i + 1} / ${toInsert.length}`;
        }
      }
    }

    const reportLines = [];
    if (alreadyExists.length) {
      reportLines.push(
        `• ${
          alreadyExists.length
        } MLB(s) não inseridos (já existiam): ${alreadyExists
          .slice(0, 10)
          .join(", ")}${alreadyExists.length > 10 ? "…" : ""}`
      );
    }
    if (duplicatedInInput.length) {
      reportLines.push(
        `• ${
          duplicatedInInput.length
        } MLB(s) ignorados (duplicados no texto): ${duplicatedInInput
          .slice(0, 10)
          .join(", ")}${duplicatedInInput.length > 10 ? "…" : ""}`
      );
    }
    if (skippedBackList.length) {
      reportLines.push(
        `• ${
          skippedBackList.length
        } MLB(s) não inseridos (já existiam no backend): ${skippedBackList
          .slice(0, 10)
          .join(", ")}${skippedBackList.length > 10 ? "…" : ""}`
      );
    }

    toast(
      `✅ Finalizado.\nInseridos: ${okCount}\n${
        errCount ? `Erros: ${errCount}\n` : ""
      }${reportLines.length ? "\n" + reportLines.join("\n") : ""}`.trim()
    );

    if (status) status.textContent = "Processo concluído.";
    closeAddMlbsPanel();

    if (progressWrap) {
      setTimeout(() => {
        progressWrap.hidden = true;
      }, 800);
    }

    await loadRows();
  }

  // =========================
  // Selecionar todos global / limpar seleção
  // =========================
  function handleSelectAllGlobal() {
    if (!rows.length) return;
    selectedAll = true;
    selectedMlbs.clear();
    excludedMlbs.clear();
    updateSummarySelected();
    syncSelectionUIOnPage();
    toast("✅ Modo “Selecionar todos” ativado (toda a lista).");
  }

  function handleClearSelection() {
    resetSelection();
    toast("Seleção limpa.");
  }

  // =========================
  // Bind de eventos
  // =========================
  function bindStaticEvents() {
    const groupSel = $("strategicGroup");
    if (groupSel)
      groupSel.addEventListener("change", () => {
        resetSelection();
        loadRows();
      });

    const btnAddRow = $("btnAddRow");
    if (btnAddRow) btnAddRow.addEventListener("click", openAddMlbsPanel);

    const btnAddMlbsConfirm = $("btnAddMlbsConfirm");
    const btnAddMlbsCancel = $("btnAddMlbsCancel");
    if (btnAddMlbsConfirm)
      btnAddMlbsConfirm.addEventListener("click", handleAddMlbsConfirm);
    if (btnAddMlbsCancel)
      btnAddMlbsCancel.addEventListener("click", (ev) => {
        ev.preventDefault();
        closeAddMlbsPanel();
      });

    const btnToggleUpload = $("btnToggleUpload");
    const uploadPanel = $("uploadPanel");
    const btnCloseUpload = $("btnCloseUpload");
    if (btnToggleUpload && uploadPanel)
      btnToggleUpload.addEventListener("click", () => {
        uploadPanel.hidden = !uploadPanel.hidden;
      });
    if (btnCloseUpload && uploadPanel)
      btnCloseUpload.addEventListener("click", () => {
        uploadPanel.hidden = true;
      });

    const btnProcessFile = $("btnProcessFile");
    if (btnProcessFile)
      btnProcessFile.addEventListener("click", handleUploadProcess);

    // ✅ REMOVIDO: preço global não existe mais no HTML
    // const btnFillPromo = $("btnFillPromoFromGlobal");
    // if (btnFillPromo) btnFillPromo.addEventListener("click", handleFillPromoFromGlobal);

    const btnApplySelected = $("btnApplySelected");
    if (btnApplySelected)
      btnApplySelected.addEventListener("click", handleApplySelected);

    const btnDeleteSelected = $("btnDeleteSelected");
    if (btnDeleteSelected)
      btnDeleteSelected.addEventListener("click", handleDeleteSelected);

    const btnSyncSelected = $("btnSyncSelected");
    if (btnSyncSelected)
      btnSyncSelected.addEventListener("click", handleSyncSelected);

    // ✅ Selecionar todos GLOBAL (id correto)
    const btnSelectAllGlobal = $("btnSelectAllGlobal");
    if (btnSelectAllGlobal)
      btnSelectAllGlobal.addEventListener("click", handleSelectAllGlobal);

    const btnClearSelection = $("btnClearSelection");
    if (btnClearSelection)
      btnClearSelection.addEventListener("click", handleClearSelection);

    // Checkbox do header (seleciona somente a página)
    const chkAll = $("chkSelectAllRows");
    if (chkAll) {
      chkAll.addEventListener("change", () => {
        const tbody = $("tbodyStrategicos");
        if (!tbody) return;

        const checks = Array.from(tbody.querySelectorAll(".row-select"));
        checks.forEach((cb) => {
          const mlb = getRowMlbFromCheckbox(cb);
          cb.checked = chkAll.checked;
          setMlbSelected(mlb, chkAll.checked);
        });

        updateSummarySelected();
        syncSelectionUIOnPage();
      });
    }

    const tbody = $("tbodyStrategicos");
    if (tbody) {
      // Delegação: mudança em checkbox e input promo
      tbody.addEventListener("change", (ev) => {
        const target = ev.target;
        if (!target) return;

        // Checkbox da linha
        if (target.classList.contains("row-select")) {
          const mlb = getRowMlbFromCheckbox(target);
          setMlbSelected(mlb, !!target.checked);
          updateSummarySelected();
          syncSelectionUIOnPage();
          return;
        }

        // Input Preço Promo
        if (target.classList.contains("input-money")) {
          const tr = target.closest("tr[data-mlb]");
          if (!tr) return;

          const mlb = tr.getAttribute("data-mlb");
          const row = rows.find(
            (r) => String(r.mlb).toUpperCase() === String(mlb).toUpperCase()
          );
          if (!row) return;

          const n = target.value === "" ? null : Number(target.value);
          row.promo_price = Number.isFinite(n) ? n : null;

          // ✅ Atualiza só a célula da % calculada (sem re-render geral)
          updatePctCalcCell(tr, row);
        }
      });

      // Busca por MLB
      const mlbSearch = $("mlbSearch");
      if (mlbSearch) {
        mlbSearch.addEventListener("input", () => {
          mlbQuery = mlbSearch.value || "";
          applyMlbFilter();
          renderTable();
        });
      }

      // Delegação: botões por linha
      tbody.addEventListener("click", (ev) => {
        const btn = ev.target.closest("button[data-action]");
        if (!btn) return;

        const tr = btn.closest("tr[data-mlb]");
        if (!tr) return;

        const mlb = tr.getAttribute("data-mlb");
        const id = tr.getAttribute("data-id");
        const action = btn.getAttribute("data-action");

        if (action === "save-row") saveRow(id || mlb);
        else if (action === "sync-row") syncRow(id || mlb);
        else if (action === "delete-row") deleteRow(mlb);
      });
    }

    // Paginação
    const pagination = $("strategicPagination");
    if (pagination) {
      pagination.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-page]");
        if (!btn) return;

        const action = btn.getAttribute("data-page");
        const totalPages = Math.max(
          1,
          Math.ceil((filteredRows || []).length / PAGE_SIZE)
        );

        if (action === "prev" && currentPage > 1) currentPage -= 1;
        else if (action === "next" && currentPage < totalPages)
          currentPage += 1;
        else {
          const n = Number(action);
          if (Number.isFinite(n))
            currentPage = Math.min(Math.max(1, n), totalPages);
        }

        renderTable(); // mantém seleção e reflete checkbox
      });
    }
  }

  // =========================
  // Boot
  // =========================
  document.addEventListener("DOMContentLoaded", () => {
    bindStaticEvents();
    loadRows();
  });
})();
