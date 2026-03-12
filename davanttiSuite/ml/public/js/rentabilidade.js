(() => {
  "use strict";

  const moneyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const numFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const pctFmt = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const PAGE_SIZE = 25;
  const state = { items: [], campaigns: [], page: 1 };

  const $ = (id) => document.getElementById(id);
  const els = {
    form: $("rent-filters"), period: $("period"), dateFrom: $("date_from"), dateTo: $("date_to"), campaign: $("campaign_id"),
    alert: $("rent-alert"), tableMeta: $("rent-table-meta"), tableBody: $("rent-table-body"), note: $("rent-note"), reload: $("btn-reload"),
    template: $("btn-template"), fileInput: $("config-file"), prev: $("rent-prev"), next: $("rent-next"), pageInfo: $("rent-page-info"), loading: $("rent-loading"),
    metrics: {
      faturamento_bruto: $("metric-faturamento_bruto"), faturamento_liquido: $("metric-faturamento_liquido"), vendas_canceladas: $("metric-vendas_canceladas"), taxa_vendas: $("metric-taxa_vendas"),
      investimento: $("metric-investimento"), impostos: $("metric-impostos"), custo_envio: $("metric-custo_envio"), custo_produto: $("metric-custo_produto"),
      custo_devolucao: $("metric-custo_devolucao"), margem_contribuicao: $("metric-margem_contribuicao"), margem_contribuicao_pct: $("metric-margem_contribuicao_pct"),
    },
  };

  function todayISO() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function addDaysISO(days) { const d = new Date(); d.setDate(d.getDate() + days); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function fmtMoney(v) { return moneyFmt.format(Number(v || 0)); }
  function fmtNum(v) { return numFmt.format(Number(v || 0)); }
  function fmtPct(v) { return `${pctFmt.format(Number(v || 0))}%`; }
  function escapeHtml(v) { return String(v || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function parseInputNumber(value) { const raw = String(value || "").trim(); if (!raw) return 0; const normalized = raw.replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.-]/g, ""); const n = Number(normalized); return Number.isFinite(n) ? n : 0; }

  function setLoading(on) {
    els.loading.classList.toggle("hidden", !on);
    document.body.classList.toggle("is-blocked", !!on);
  }

  function setAlert(type = "info", text = "") {
    els.alert.className = `rent-alert rent-alert--${type}`;
    els.alert.textContent = text || (type === "error" ? "Falha ao carregar." : "Base filtrada exclusivamente por anúncios presentes em Product Ads.");
  }

  function fillMetrics(summary) {
    Object.entries(els.metrics).forEach(([k, el]) => { if (!el) return; });
    els.metrics.faturamento_bruto.textContent = fmtMoney(summary.faturamento_bruto);
    els.metrics.faturamento_liquido.textContent = fmtMoney(summary.faturamento_liquido);
    els.metrics.vendas_canceladas.textContent = fmtMoney(summary.vendas_canceladas);
    els.metrics.taxa_vendas.textContent = fmtMoney(summary.taxa_vendas);
    els.metrics.investimento.textContent = fmtMoney(summary.investimento);
    els.metrics.impostos.textContent = fmtMoney(summary.impostos);
    els.metrics.custo_envio.textContent = fmtMoney(summary.custo_envio);
    els.metrics.custo_produto.textContent = fmtMoney(summary.custo_produto);
    els.metrics.custo_devolucao.textContent = fmtMoney(summary.custo_devolucao);
    els.metrics.margem_contribuicao.textContent = fmtMoney(summary.margem_contribuicao);
    els.metrics.margem_contribuicao_pct.textContent = fmtPct(summary.margem_contribuicao_pct);
  }

  function updateCustomFields() {
    const custom = els.period.value === "custom";
    els.dateFrom.disabled = !custom;
    els.dateTo.disabled = !custom;
    if (custom) return;
    const span = els.period.value === "7d" ? 6 : els.period.value === "14d" ? 13 : 29;
    els.dateFrom.value = addDaysISO(-span);
    els.dateTo.value = todayISO();
  }

  function fillCampaignOptions(campaigns, selected) {
    const current = selected || els.campaign.value;
    els.campaign.innerHTML = '<option value="">Todas as campanhas</option>' + campaigns.map((c) => {
      const label = c.status ? `${c.name || `Campanha ${c.id}`} (${c.status})` : (c.name || `Campanha ${c.id}`);
      return `<option value="${escapeHtml(c.id)}"${String(c.id) === String(current) ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function statusBadge(value) {
    const txt = String(value || "—");
    const key = txt.toLowerCase();
    const cls = key.includes("active") || key.includes("ativo") ? "ok" : key.includes("paused") || key.includes("pause") ? "warn" : "idle";
    return `<span class="badge badge--${cls}">${escapeHtml(txt)}</span>`;
  }
  function boolPill(label, active, extraCls = "") { return `<span class="mini-pill ${active ? 'on' : ''} ${extraCls}">${escapeHtml(label)}</span>`; }

  function rowHtml(item) {
    const quality = item.publication_quality == null ? "-" : `${fmtNum(item.publication_quality)}%`;
    const estoqueTxt = item.estoque == null ? "-" : fmtNum(item.estoque);
    const duracaoTxt = item.duracao_estoque == null ? "-" : `${fmtNum(item.duracao_estoque)} dias`;
    const thumb = item.thumbnail ? `<img src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.title)}">` : `<div class="thumb-fallback">ML</div>`;
    return `
      <tr data-item-id="${escapeHtml(item.item_id)}">
        <td class="sticky-col">
          <div class="item-cell">
            <div class="item-cell__thumb">${thumb}</div>
            <div class="item-cell__body">
              <div class="item-cell__meta">SKU: ${escapeHtml(item.sku || "-")}<br>ID: ${escapeHtml(item.item_id)}</div>
              <a class="item-cell__title" href="${escapeHtml(item.permalink || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
              <div class="item-cell__price">${item.original_price > item.price ? `<s>${fmtMoney(item.original_price)}</s> ` : ''}<strong>${fmtMoney(item.price)}</strong></div>
              <div class="item-cell__pills">
                ${item.curva ? `<span class="curve-pill">Curva ${escapeHtml(item.curva)}</span>` : ''}
                ${boolPill("Publicidade", !!item.publicidade)}
                ${boolPill("Promo", !!item.has_active_promotion, "is-promo")}
                ${boolPill("Catálogo", !!item.catalog, "is-catalog")}
                ${boolPill("FULL", !!item.full, "is-full")}
                ${statusBadge(item.status || '—')}
                ${statusBadge(item.campaign_status || '—')}
              </div>
              <div class="item-cell__campaign">${escapeHtml(item.campaign_name || '-')}</div>
            </div>
          </div>
        </td>
        <td class="num"><span class="quality-pill">${quality}</span></td>
        <td class="num"><div class="inline-editor"><input class="inline-editor__input js-cost" type="text" value="${escapeHtml(String((item.custo_produto_unitario ?? 0).toFixed(2)).replace('.', ','))}"><div class="inline-editor__actions"><button class="mini-btn js-save" type="button">Salvar</button><button class="mini-link js-history" type="button">Histórico</button></div></div></td>
        <td class="num"><div class="inline-editor"><input class="inline-editor__input js-tax" type="text" value="${escapeHtml(String((item.aliquota ?? 0).toFixed(2)).replace('.', ','))}"><div class="inline-editor__actions"><button class="mini-btn js-save" type="button">Salvar</button><button class="mini-link js-history" type="button">Histórico</button></div></div></td>
        <td class="num">${fmtMoney(item.faturamento)}</td>
        <td class="num">${fmtMoney(item.bonificacoes)}</td>
        <td class="num">${fmtNum(item.unidades_vendidas)}</td>
        <td class="num">${fmtMoney(item.ticket_medio)}</td>
        <td class="num">${fmtMoney(item.custo_produto)}</td>
        <td class="num">${fmtMoney(item.custo_publicacao)}</td>
        <td class="num">${fmtMoney(item.custo_envio)}</td>
        <td class="num">${fmtMoney(item.custo_devolucao)}</td>
        <td class="num">${fmtMoney(item.investimento)}</td>
        <td class="num">${fmtMoney(item.impostos)}</td>
        <td class="num">${fmtMoney(item.margem_contribuicao)}</td>
        <td class="num">${fmtMoney(item.margem_sem_publicidade)}</td>
        <td class="num">${fmtPct(item.mc_pct)}</td>
        <td class="num">${fmtPct(item.mc_sem_ads_pct)}</td>
        <td class="num">${fmtPct(item.share_lucro)}</td>
        <td class="num">${estoqueTxt}</td>
        <td class="num">${duracaoTxt}</td>
      </tr>`;
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.items.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    els.pageInfo.textContent = `Página ${state.page} de ${totalPages}`;
    els.prev.disabled = state.page <= 1;
    els.next.disabled = state.page >= totalPages;
  }

  function renderRows() {
    if (!state.items.length) {
      els.tableBody.innerHTML = '<tr><td colspan="21" class="table-empty">Nenhum anúncio encontrado para os filtros selecionados.</td></tr>';
      renderPagination();
      return;
    }
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = state.items.slice(start, start + PAGE_SIZE);
    els.tableBody.innerHTML = slice.map(rowHtml).join("");
    renderPagination();
  }

  function buildQuery() {
    const params = new URLSearchParams();
    const fd = new FormData(els.form);
    for (const [key, rawValue] of fd.entries()) {
      if (rawValue instanceof File) continue;
      const value = String(rawValue || "").trim();
      if (!value) continue;
      if (els.period.value !== "custom" && (key === "date_from" || key === "date_to")) continue;
      if (["classify_by_variation", "only_without_product_cost", "group_by_family"].includes(key)) { params.set(key, "true"); continue; }
      params.set(key, value);
    }
    return params;
  }

  async function loadOverview() {
    setLoading(true);
    setAlert("info", "Carregando dados...");
    els.note.textContent = "Carregando dados...";
    try {
      const params = buildQuery();
      const response = await fetch(mlUrl(`/api/rentabilidade/overview?${params.toString()}`), { credentials: "include", headers: { accept: "application/json" }, cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || "Falha ao carregar a tela de rentabilidade.");
      fillMetrics(data.summary || {});
      state.campaigns = data.campaigns || [];
      fillCampaignOptions(state.campaigns, data.filters?.campaign_id || "");
      state.items = data.items || [];
      state.page = 1;
      renderRows();
      els.tableMeta.textContent = `${fmtNum(data.meta?.total_items || 0)} anúncios encontrados • ${data.filters?.date_from || '—'} até ${data.filters?.date_to || '—'}`;
      els.note.textContent = data.meta?.note || "Dados carregados.";
      setAlert("info", "Base filtrada exclusivamente por anúncios presentes em Product Ads. Custo de envio é buscado nos envios da venda e bonificações são derivadas dos dados transacionais disponíveis.");
    } catch (error) {
      els.tableMeta.textContent = "Não foi possível carregar os anúncios.";
      els.note.textContent = "Falha ao carregar.";
      state.items = [];
      renderRows();
      setAlert("error", error.message || String(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveRowConfig(rowEl) {
    const itemId = rowEl?.dataset?.itemId;
    if (!itemId) return;
    const payload = {
      custo_produto_unitario: parseInputNumber(rowEl.querySelector('.js-cost')?.value),
      aliquota: parseInputNumber(rowEl.querySelector('.js-tax')?.value),
    };
    const response = await fetch(mlUrl(`/api/rentabilidade/config/${encodeURIComponent(itemId)}`), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Falha ao salvar configuração.');
    setAlert('info', `Configuração salva para ${itemId}.`);
    await loadOverview();
  }

  async function showHistory(rowEl) {
    const itemId = rowEl?.dataset?.itemId;
    if (!itemId) return;
    const response = await fetch(mlUrl(`/api/rentabilidade/config/${encodeURIComponent(itemId)}/history?limit=10`), { credentials: 'include', headers: { accept: 'application/json' } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Falha ao carregar histórico.');
    const text = (data.history || []).map((row) => {
      const when = row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '-';
      return `${when} • custo ${fmtMoney(row.custo_produto_unitario)} • alíquota ${fmtPct(row.aliquota)} • ${row.source || 'manual'}`;
    }).join('\n') || 'Sem histórico.';
    window.alert(`Histórico ${itemId}\n\n${text}`);
  }

  function downloadTemplate() {
    const csv = 'item_id;custo_produto_unitario;aliquota\nMLB123456789;199,90;10\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'rentabilidade-modelo.csv'; a.click(); URL.revokeObjectURL(url);
  }

  async function fileToBase64(file) {
    const buffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    return btoa(binary);
  }

  async function handleImport(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      els.note.textContent = 'Importando planilha...';
      const content_base64 = await fileToBase64(file);
      const response = await fetch(mlUrl('/api/rentabilidade/import-configs'), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ filename: file.name, content_base64 }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Falha ao importar.');
      setAlert('info', `Importação concluída: ${fmtNum(data.report?.inserted || 0)} linha(s) atualizadas.`);
      els.note.textContent = 'Planilha importada com sucesso.';
      await loadOverview();
    } catch (error) {
      setAlert('error', error.message || String(error));
      els.note.textContent = 'Falha na importação.';
    } finally {
      event.target.value = '';
      setLoading(false);
    }
  }

  function initDefaults() {
    els.period.value = '30d';
    els.dateFrom.value = addDaysISO(-29);
    els.dateTo.value = todayISO();
    updateCustomFields();
  }

  document.addEventListener('click', async (event) => {
    const saveBtn = event.target.closest('.js-save');
    if (saveBtn) {
      const row = saveBtn.closest('tr');
      setLoading(true);
      try { saveBtn.disabled = true; await saveRowConfig(row); } catch (error) { setAlert('error', error.message || String(error)); } finally { saveBtn.disabled = false; setLoading(false); }
      return;
    }
    const historyBtn = event.target.closest('.js-history');
    if (historyBtn) {
      const row = historyBtn.closest('tr');
      setLoading(true);
      try { await showHistory(row); } catch (error) { setAlert('error', error.message || String(error)); } finally { setLoading(false); }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initDefaults();
    els.period.addEventListener('change', updateCustomFields);
    els.form.addEventListener('submit', (event) => { event.preventDefault(); loadOverview(); });
    els.reload.addEventListener('click', loadOverview);
    els.template.addEventListener('click', downloadTemplate);
    els.fileInput.addEventListener('change', handleImport);
    els.prev.addEventListener('click', () => { if (state.page > 1) { state.page -= 1; renderRows(); } });
    els.next.addEventListener('click', () => { const totalPages = Math.max(1, Math.ceil(state.items.length / PAGE_SIZE)); if (state.page < totalPages) { state.page += 1; renderRows(); } });
    loadOverview();
  });
})();
