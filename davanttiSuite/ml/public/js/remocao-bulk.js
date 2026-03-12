/* Fila para remoção utilizando APENAS o fluxo legado:
   - POST /anuncios/remover-promocoes-lote  -> { success, process_id }
   - GET  /anuncios/status-remocao/:id      -> { status, progresso, sucessos, erros, ... }

   Inclui "badge" (pill) com a conta ativa no JobsPanel.
*/
(function(){
  // Base path helper (ex.: app montado em /ml)
  const __APP_BASE__ =
    window.__APP_BASE_PATH__ ||
    ((location.pathname || '').startsWith('/ml/') || (location.pathname || '') === '/ml'
      ? '/ml'
      : '');

  function withBase(path) {
    if (!__APP_BASE__) return path;
    if (!path) return __APP_BASE__;
    return path.startsWith('/') ? __APP_BASE__ + path : __APP_BASE__ + '/' + path;
  }

  const QUEUE = [];
  let running = false;

  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  // Mapeia conta -> classe CSS do badge
  function mapAccountBadge(key, label){
    const k = String(key || '').toLowerCase();
    if (k === 'drossi')     return { text: label || 'Drossi',      cls: 'badge-drossi' };
    if (k === 'diplany')    return { text: label || 'Diplany',     cls: 'badge-diplany' };
    if (k === 'rossidecor') return { text: label || 'Rossi Decor', cls: 'badge-rossidecor' };
    return { text: label || (key || 'Conta'), cls: 'badge-default' };
  }

  async function getAccountBadge(){
    try {
      if (window.__ACCOUNT__?.key) {
        return mapAccountBadge(window.__ACCOUNT__.key, window.__ACCOUNT__.label);
      }
      const r = await fetch(withBase('/api/account/current'), { cache:'no-store' });
      const j = await r.json().catch(()=>({}));
      const key = j.accountKey || j.key || 'default';
      const label = j.label || key;
      return mapAccountBadge(key, label);
    } catch {
      return { text: 'Conta', cls: 'badge-default' };
    }
  }

  async function startJob(entry){
    const badge = await getAccountBadge();

    // cria job no painel (id temporário)
    const tempId = JobsPanel.addLocalJob({
      title: entry.title || `Remoção – ${entry.items.length} itens`,
      badge
    });

    // manter referência do id atual do job (inicia como tempId)
    let jobId = tempId;

    try {
      // novo fluxo de jobs (API /api/promocoes)
      const resp = await fetch(withBase('/api/promocoes/jobs/remove'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: entry.items,
          delay_ms: entry.delayMs ?? 250
        })
      });
      const data = await resp.json().catch(()=> ({}));
      if (!resp.ok || !data.ok || !data.job_id) {
        JobsPanel.updateLocalJob(jobId, { progress: 100, state: 'erro ao iniciar', completed: true });
        return;
      }

      // troca o id temporário pelo job_id (evita duplicados)
      jobId = JobsPanel.replaceId(tempId, String(data.job_id));

      // loop de status
      let done = false;
      while (!done) {
        await wait(2500);
        let st;
        try {
          const r = await fetch(withBase('/api/promocoes/jobs/' + jobId), {
            cache: 'no-store',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
          });
          st = await r.json();
        } catch { st = null; }
        if (!st) continue;

        const pct = Number(st.progress ?? st.progresso ?? 0);
        const processed = Number(st.processed ?? st.ok ?? st.sucessos ?? 0);
        const total = Number(st.total ?? st.expected_total ?? st.total_anuncios ?? 0);
        const isDone = /done|concluido/i.test(String(st.status || ''));
        const hasErrors = Number(st.err ?? st.errors ?? st.erros ?? 0) > 0;
        const ratio =
          Number.isFinite(processed) && Number.isFinite(total) && total > 0
            ? `${processed}/${total} — ${pct}%`
            : `${pct}%`;
        const stateText = isDone
          ? (hasErrors ? `concluído com erros` : `concluído`)
          : `processando ${ratio}`;

        JobsPanel.updateLocalJob(jobId, {
          progress: Number.isFinite(pct) ? pct : 0,
          state: stateText,
          completed: /done|concluido|erro/i.test(String(st.status || ''))
        });

        done = /done|concluido|erro/i.test(String(st.status || ''));
      }
    } catch (e) {
      // agora garante que atualiza o job correto (já pode ter sido replaceId)
      JobsPanel.updateLocalJob(jobId, { progress: 100, state: 'falha inesperada', completed: true });
    }
  }

  async function pump(){
    if (running) return;
    running = true;
    while (QUEUE.length) {
      const entry = QUEUE.shift();
      await startJob(entry);
    }
    running = false;
  }

  async function enqueue({ items, delayMs = 250, title }){
    const list = (Array.isArray(items) ? items : []).map(s => String(s).trim()).filter(Boolean);
    if (!list.length) throw new Error('Nenhum MLB válido para enfileirar');
    QUEUE.push({ items: list, delayMs, title });
    pump(); // não aguarda
  }

  window.RemocaoBulk = { enqueue };
})();
