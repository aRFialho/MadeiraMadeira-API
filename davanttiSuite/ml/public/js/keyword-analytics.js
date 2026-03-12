/* Keyword Analytics UI (Ubersuggest-like) */
(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    itemId: $("kaItemId"),
    seed: $("kaSeed"),
    site: $("kaSite"),
    limit: $("kaLimit"),
    pages: $("kaPages"),
    btnRun: $("btnBuscarPalavras"),
    btnClear: $("btnLimpar"),
    chip: $("kaAccountChip"),
    itemCard: $("kaItemCard"),
    steps: $("kaSteps"),
    err: $("kaError"),
    errMsg: $("kaErrorMsg"),
    cta1: $("kaCtaPrimary"),
    cta2: $("kaCtaSecondary"),
    tabs: $("kaTabs"),
    tabOverview: $("tab-overview"),
    tabSuggestions: $("tab-suggestions"),
    tabSerp: $("tab-serp"),
    tabTrend: $("tab-trend"),
    tableBody: $("kaTableBody"),
    tableBody2: $("kaTableBody2"),
    mRank: $("mRank"),
    mComp: $("mComp"),
    mTrend: $("mTrend"),
    mBest: $("mBest"),
    mRankS: $("mRankS"),
    mCompS: $("mCompS"),
    mTrendS: $("mTrendS"),
    mBestS: $("mBestS"),
    drawerOverlay: $("kaDrawerOverlay"),
    drawer: $("kaDrawer"),
    drawerTitle: $("kaDrawerTitle"),
    drawerBody: $("kaDrawerBody"),
    drawerClose: $("kaDrawerClose"),
  };

  function setStep(stepKey) {
    if (!els.steps) return;
    [...els.steps.querySelectorAll(".ka-step")].forEach((n) => {
      n.classList.toggle("active", n.getAttribute("data-step") === stepKey);
    });
  }

  function showError(code, message, redirect) {
    els.err.style.display = "block";
    els.errMsg.textContent = message || "Erro";
    els.cta1.style.display = "none";
    els.cta2.style.display = "none";
    if (code === "ML_AUTH_INVALID" || code === "ML_FORBIDDEN") {
      els.cta1.style.display = "inline-flex";
      els.cta1.textContent = "Reautenticar";
      if (redirect) els.cta1.href = redirect; else els.cta1.href = mlUrl("/select-conta");
    }
    if (code === "ML_ITEM_NOT_OWNED") {
      els.cta2.style.display = "inline-flex";
      els.cta2.textContent = "Trocar conta";
      if (redirect) els.cta2.href = redirect; else els.cta2.href = mlUrl("/select-conta");
    }
  }

  function clearError() {
    els.err.style.display = "none";
  }

  function rankBadge(rank, bucket) {
    const txt = rank ? `#${rank}` : (bucket || ">250");
    let cls = "rank-bad";
    if (rank && rank <= 20) cls = "rank-good";
    else if (rank && rank <= 100) cls = "rank-mid";
    return `<span class="badge ${cls}">${txt}</span>`;
  }

  function progressBar(v01) {
    const pct = Math.max(0, Math.min(100, Math.round((v01 || 0) * 100)));
    return `<div class="progress"><i style="width:${pct}%"></i></div>`;
  }

  function actionButtons(k) {
    return `
      <span class="ka-action">
        <button class="btn-mini primary" data-act="titles" data-kw="${encodeURIComponent(k.keyword)}">Títulos</button>
        <button class="btn-mini" data-act="copykw" data-kw="${encodeURIComponent(k.keyword)}">Copiar</button>
      </span>
    `;
  }

  function renderRows(keywords, tbody) {
    if (!tbody) return;
    if (!keywords || !keywords.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--ka-muted); padding:18px;">Sem sugestões ainda.</td></tr>`;
      return;
    }
    tbody.innerHTML = keywords.map((k) => `
      <tr>
        <td><b>${escapeHtml(k.keyword)}</b></td>
        <td>${rankBadge(k.rank, k.rank_bucket)}</td>
        <td>${progressBar(k.competition)}</td>
        <td><span class="badge">${Math.round((k.trend||0)*100)}%</span></td>
        <td><span class="badge">${Math.round((k.relevance||0)*100)}%</span></td>
        <td><span class="badge">${Math.round((k.score||0)*100)}%</span></td>
        <td>${actionButtons(k)}</td>
      </tr>
    `).join("");
  }

  function renderSummary(summary) {
    if (!summary) return;
    els.mRank.textContent = summary.avg_rank ? `#${Math.round(summary.avg_rank)}` : "—";
    els.mComp.textContent = summary.avg_competition != null ? `${Math.round(summary.avg_competition*100)}%` : "—";
    els.mTrend.textContent = summary.avg_trend != null ? `${Math.round(summary.avg_trend*100)}%` : "—";
    els.mBest.textContent = summary.best_keyword?.keyword ? summary.best_keyword.keyword : "—";
    els.mBestS.textContent = summary.best_keyword?.score != null ? `Score: ${Math.round(summary.best_keyword.score*100)}%` : "—";
  }

  function renderItem(item) {
    if (!item) return;
    const title = item.title || "—";
    const status = item.status || "—";
    const cat = item.category_id || "—";
    els.itemCard.innerHTML = `
      <div class="row"><span class="label">Status</span><span class="value">${escapeHtml(status)}</span></div>
      <div class="row" style="margin-top:8px;"><span class="label">Título</span><span class="value">${escapeHtml(shorten(title, 46))}</span></div>
      <div class="row" style="margin-top:8px;"><span class="label">Categoria</span><span class="value">${escapeHtml(cat)}</span></div>
      ${item.permalink ? `<div style="margin-top:10px;"><a href="${item.permalink}" target="_blank" style="font-weight:800; color:var(--ka-blue); text-decoration:none;">Abrir anúncio →</a></div>` : ""}
    `;
  }

  function openDrawer(keyword, suggestions) {
    els.drawerTitle.textContent = `Sugestões: ${keyword}`;
    els.drawerBody.innerHTML = (suggestions || []).map((t) => `
      <div class="sug-card">
        <div class="txt">${escapeHtml(t)}</div>
        <div class="acts">
          <button class="btn-mini" data-act="copytitle" data-title="${encodeURIComponent(t)}">Copiar</button>
        </div>
      </div>
    `).join("") || `<div style="color:var(--ka-muted); padding:10px;">Sem sugestões para esta keyword.</div>`;
    els.drawerOverlay.classList.add("open");
    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    els.drawerOverlay.classList.remove("open");
    els.drawer.classList.remove("open");
    els.drawer.setAttribute("aria-hidden", "true");
  }

  function switchTab(tab) {
    els.tabOverview.style.display = tab === "overview" ? "" : "none";
    els.tabSuggestions.style.display = tab === "suggestions" ? "" : "none";
    els.tabSerp.style.display = tab === "serp" ? "" : "none";
    els.tabTrend.style.display = tab === "trend" ? "" : "none";
    [...els.tabs.querySelectorAll(".ka-tab")].forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  }

  async function loadContext() {
    try {
      const acc = await (window.AccountBar?.ensure?.() ?? Promise.resolve(window.__ACCOUNT__ || null));
      if (acc?.label) {
        els.chip.textContent = `Conta: ${acc.label}`;
        return;
      }

      const r = await fetch(mlUrl("/api/account/current"), { headers: { Accept: "application/json" } });
      if (!r.ok) return;
      const j = await r.json().catch(() => null);
      const label = j?.label || j?.current?.label || j?.account?.label || null;
      if (label) els.chip.textContent = `Conta: ${label}`;
    } catch {}
  }

  async function run() {
    clearError();
    const item_id = String(els.itemId.value || "").trim().toUpperCase();
    const seed = String(els.seed.value || "").trim();
    const site = String(els.site.value || "MLB").trim().toUpperCase();
    const limit = parseInt(els.limit.value || "25", 10);
    const pages = parseInt(els.pages.value || "5", 10);

    if (!item_id) {
      showError("VALIDATION", "Informe um item_id (MLB...).");
      return;
    }

    setStep("item");
    els.tableBody.innerHTML = `<tr><td colspan="7" style="color:var(--ka-muted); padding:18px;">Carregando…</td></tr>`;
    if (els.tableBody2) els.tableBody2.innerHTML = "";

    const url = new URL(mlUrl("/api/keyword-analytics/suggest"), window.location.origin);
    url.searchParams.set("item_id", item_id);
    if (seed) url.searchParams.set("seed", seed);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("pages", String(pages));
    url.searchParams.set("site", site);

    try {
      const r = await fetch(url.toString(), { headers: { "Accept": "application/json" } });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.success === false) {
        const code = j?.code || (r.status === 401 ? "ML_AUTH_INVALID" : "ERROR");
        showError(code, j?.message || "Falha ao gerar sugestões.", j?.redirect);
        return;
      }

      setStep("serp");
      renderItem(j.item);
      renderSummary(j.summary);
      setStep("score");
      renderRows(j.keywords, els.tableBody);
      renderRows(j.keywords, els.tableBody2);
      switchTab("overview");
    } catch (e) {
      showError("ERROR", "Erro ao conectar no servidor.");
    }
  }

  function clearAll() {
    els.itemId.value = "";
    els.seed.value = "";
    els.limit.value = "25";
    els.pages.value = "5";
    clearError();
    renderItem(null);
    renderSummary(null);
    els.tableBody.innerHTML = `<tr><td colspan="7" style="color:var(--ka-muted); padding:18px;">Digite um MLB e clique em <b>Analisar</b> para começar.</td></tr>`;
    if (els.tableBody2) els.tableBody2.innerHTML = "";
  }

  function escapeHtml(str){
    return String(str||"").replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
  }
  function shorten(s, n){ s=String(s||""); return s.length>n? s.slice(0,n-1)+"…": s; }

  // Events
  els.btnRun?.addEventListener("click", run);
  els.btnClear?.addEventListener("click", clearAll);

  els.tabs?.addEventListener("click", (ev) => {
    const b = ev.target.closest(".ka-tab");
    if (!b) return;
    switchTab(b.dataset.tab);
  });

  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (!act) return;

    if (act === "copykw") {
      const kw = decodeURIComponent(btn.getAttribute("data-kw") || "");
      navigator.clipboard?.writeText(kw);
      return;
    }
    if (act === "titles") {
      const kw = decodeURIComponent(btn.getAttribute("data-kw") || "");
      // find keyword in latest table by reading window.__kaLast
      const found = (window.__kaLast || []).find((k) => k.keyword === kw);
      openDrawer(kw, found?.title_suggestions || []);
      return;
    }
    if (act === "copytitle") {
      const title = decodeURIComponent(btn.getAttribute("data-title") || "");
      navigator.clipboard?.writeText(title);
      return;
    }
  });

  els.drawerOverlay?.addEventListener("click", closeDrawer);
  els.drawerClose?.addEventListener("click", closeDrawer);

  // Hook into renderRows to store latest
  const _renderRows = renderRows;
  renderRows = function(keywords, tbody){
    if (tbody === els.tableBody) window.__kaLast = keywords || [];
    return _renderRows(keywords, tbody);
  }

  loadContext();
})();
