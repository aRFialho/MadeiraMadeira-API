// services/promocaoService.js
const fetch = require('node-fetch');
const TokenService = require('./tokenService');
const config = require('../config/config');

// ---------- helpers de credenciais/rotas ----------

function accountKeyFrom(opts = {}) {
  const k =
    opts.accountKey ||
    opts.key ||
    opts.mlCreds?.account_key ||
    opts.mlCreds?.accountKey ||
    process.env.ACCOUNT_KEY ||
    process.env.SELECTED_ACCOUNT ||
    null;
  return (k || 'sem-conta').toLowerCase();
}

function resolveCredsFrom(opts = {}) {
  // credenciais vindas do ensureAccount (req/res.locals) têm prioridade
  const c = {
    app_id:        opts.mlCreds?.app_id        || process.env.APP_ID        || process.env.ML_APP_ID,
    client_secret: opts.mlCreds?.client_secret || process.env.CLIENT_SECRET  || process.env.ML_CLIENT_SECRET,
    refresh_token: opts.mlCreds?.refresh_token || process.env.REFRESH_TOKEN  || process.env.ML_REFRESH_TOKEN,
    access_token:  opts.mlCreds?.access_token  || process.env.ACCESS_TOKEN   || process.env.ML_ACCESS_TOKEN,
    redirect_uri:  opts.mlCreds?.redirect_uri  || process.env.REDIRECT_URI   || process.env.ML_REDIRECT_URI,
  };
  const key = accountKeyFrom(opts);
  return {
    ...c,
    account_key: key,   // snake_case → usado pelo TokenService
    accountKey:  key,   // camelCase → útil pra logs locais
  };
}

function urls() {
  return {
    users_me:      config?.urls?.users_me || 'https://api.mercadolibre.com/users/me',
    items_base:    config?.urls?.items || 'https://api.mercadolibre.com/items',
    seller_promos: config?.urls?.seller_promotions || 'https://api.mercadolibre.com/seller-promotions',
  };
}

// ---------- auth state e fetch com renovação sob demanda ----------

/**
 * Monta um "state" de autenticação reutilizável no lote.
 * - Resolve credenciais da conta
 * - Garante um token válido (renova se necessário)
 */
async function prepararAuthState(options = {}) {
  const creds = resolveCredsFrom(options);

  // monta o pacote completo para o TokenService (evita ler só de process.env)
  const merged = {
    ...creds,
    access_token: options.access_token || creds.access_token,
    account_key:  creds.account_key || creds.accountKey || null,
  };

  // se já temos token, validamos/renovamos se preciso; se não, renovamos
  const token = await TokenService.renovarTokenSeNecessario(merged);

  return {
    token,
    creds: merged,
    key: merged.account_key || 'sem-conta', // prefixo de log correto
  };
}

/**
 * Faz fetch com Authorization e, em caso de 401, renova UMA vez e repete.
 * Atualiza state.token se renovar.
 */
async function authFetch(url, init, state) {
  const doCall = async (tok) => {
    const headers = { ...(init?.headers || {}), Authorization: `Bearer ${tok}` };
    return fetch(url, { ...init, headers });
  };

  // primeira tentativa
  let resp = await doCall(state.token);
  if (resp.status !== 401) return resp;

  // 401 → renova e tenta novamente
  const renewed = await TokenService.renovarToken(state.creds);
  state.token = renewed.access_token;
  return doCall(state.token);
}

/** Espera em ms */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// =====================================================
//                    SERVIÇO
// =====================================================

class PromocaoService {
  /**
   * Remove promoções de um único item.
   * @param {string} mlbId
   * @param {object} optionsOrState - pode ser:
   *   { access_token?, mlCreds?, accountKey?, logger? }  (opções)
   *   OU um state retornado por prepararAuthState() {token, creds, key}
   */
  static async removerPromocaoUnico(mlbId, optionsOrState = {}) {
    // aceitar tanto "state" (com token pronto) quanto "options"
    const state = (optionsOrState && optionsOrState.token && optionsOrState.creds)
      ? optionsOrState
      : await prepararAuthState(optionsOrState);

    const log = (msg, ...rest) =>
      (optionsOrState.logger || console).log(`[${state.key}] ${msg}`, ...rest);

    try {
      const U = urls();
      const baseHeaders = { 'Content-Type': 'application/json' };

      log(`🔍 Verificando anúncio ${mlbId}...`);
      // 1) buscar item
      let rItem = await authFetch(`${U.items_base}/${mlbId}`, { method: 'GET', headers: baseHeaders }, state);
      if (!rItem.ok) {
        throw new Error(`Erro ao buscar anúncio: HTTP ${rItem.status}`);
      }
      const itemData = await rItem.json();

      // 2) validar pertencimento (users/me)
      const rMe = await authFetch(U.users_me, { method: 'GET', headers: baseHeaders }, state);
      if (!rMe.ok) {
        throw new Error(`Falha em users/me: HTTP ${rMe.status}`);
      }
      const userData = await rMe.json();
      if (itemData.seller_id !== userData.id) {
        throw new Error('Este anúncio não pertence à sua conta');
      }
      log(`✅ Anúncio encontrado: ${itemData.title}`);

      // 3) listar promoções do item
      log(`🔍 Consultando promoções do item ${mlbId}...`);
      const promoUrl = `${U.seller_promos}/items/${mlbId}?app_version=v2`;
      const rProm = await authFetch(promoUrl, { method: 'GET', headers: baseHeaders }, state);

      if (rProm.status === 404) {
        return {
          success: true,
          message: 'Item não possui promoções ativas',
          mlb_id: mlbId,
          titulo: itemData.title,
          preco_atual: itemData.price,
          tinha_promocao: false
        };
      }
      if (!rProm.ok) {
        throw new Error(`Erro ao consultar promoções: HTTP ${rProm.status}`);
      }

      const promotionsData = await rProm.json();
      log(`📋 Promoções encontradas: (${Array.isArray(promotionsData) ? promotionsData.length : 0})`, promotionsData);

      const lista = Array.isArray(promotionsData) ? promotionsData : [];
      if (lista.length === 0) {
        return {
          success: true,
          message: 'Item não possui promoções ativas',
          mlb_id: mlbId,
          titulo: itemData.title,
          preco_atual: itemData.price,
          tinha_promocao: false
        };
      }

      // 4) filtrar ativas
      const ativas = lista.filter(p =>
        p?.status === 'started' || p?.status === 'active' || p?.status === 'pending'
      );

      if (ativas.length === 0) {
        return {
          success: true,
          message: 'Item não possui promoções ativas no momento',
          mlb_id: mlbId,
          titulo: itemData.title,
          preco_atual: itemData.price,
          tinha_promocao: false,
          promocoes_encontradas: lista.map(p => `${p.type} - ${p.status}`)
        };
      }

      log(`🎯 Promoções ativas encontradas: ${ativas.length}`);

      const resultadoRemocao = {
        metodos_tentados: [],
        sucesso: false,
        promocoes_removidas: [],
        promocoes_com_erro: []
      };

      // 5) tentar remoção (prioriza massiva DELETE /seller-promotions/items/:id)
      for (const promocao of ativas) {
        const tipo = promocao?.type || 'UNKNOWN';
        const idPromo = promocao?.id || promocao?.campaign_id || 'sem-id';
        log(`🔄 Removendo promoção: ${tipo} (${idPromo})`);

        try {
          let remocaoSucesso = false;

          const massTypes = [
            'DEAL', 'MARKETPLACE_CAMPAIGN', 'PRICE_DISCOUNT', 'VOLUME',
            'PRE_NEGOTIATED', 'SELLER_CAMPAIGN', 'SMART', 'PRICE_MATCHING', 'UNHEALTHY_STOCK'
          ];

          if (massTypes.includes(tipo)) {
            log(`   Tentando remoção massiva para ${tipo}...`);
            const rDel = await authFetch(promoUrl, { method: 'DELETE', headers: baseHeaders }, state);

            if (!rDel.ok) {
              let errJson = {};
              try { errJson = await rDel.json(); } catch {}
              resultadoRemocao.promocoes_com_erro.push(`${tipo} - HTTP ${rDel.status}`);
              resultadoRemocao.metodos_tentados.push(`❌ ${tipo} - Erro: ${errJson?.message || rDel.status}`);
            } else {
              const delRes = await rDel.json();
              log(`   Resultado da remoção:`, delRes);

              if (delRes?.successful_ids?.length > 0) {
                remocaoSucesso = true;
                resultadoRemocao.promocoes_removidas.push(`${tipo} - Remoção massiva`);
                resultadoRemocao.metodos_tentados.push(`✅ ${tipo} - Remoção massiva SUCESSO`);
              }

              if (delRes?.errors?.length > 0) {
                for (const e of delRes.errors) {
                  resultadoRemocao.promocoes_com_erro.push(`${tipo} - ${e?.error || 'erro'}`);
                  resultadoRemocao.metodos_tentados.push(`❌ ${tipo} - ${e?.error || 'erro'}`);
                }
              }
            }
          } else if (['DOD', 'LIGHTNING'].includes(tipo) && idPromo) {
            // reservado para implementação específica se necessário
            resultadoRemocao.metodos_tentados.push(`⚠️ ${tipo} - Requer remoção individual (não implementado)`);
          }

          if (remocaoSucesso) resultadoRemocao.sucesso = true;
        } catch (err) {
          log(`❌ Erro ao remover promoção ${promocao?.type}: ${err?.message || err}`);
          resultadoRemocao.promocoes_com_erro.push(`${promocao?.type} - ${err?.message || err}`);
          resultadoRemocao.metodos_tentados.push(`❌ ${promocao?.type} - Erro: ${err?.message || err}`);
        }
      }

      // 6) verificação final após pequena espera
      log('⏳ Aguardando 3 segundos para verificar resultado...');
      await sleep(3000);

      const promoUrlCheck = `${urls().seller_promos}/items/${mlbId}?app_version=v2`;
      const rCheck = await authFetch(promoUrlCheck, { method: 'GET', headers: baseHeaders }, state);
      let promocoesRestantes = [];
      if (rCheck.ok) {
        const ver = await rCheck.json();
        const arr = Array.isArray(ver) ? ver : [];
        promocoesRestantes = arr.filter(p =>
          p?.status === 'started' || p?.status === 'active' || p?.status === 'pending'
        );
      }

      const rItem2 = await authFetch(`${urls().items_base}/${mlbId}`, { method: 'GET', headers: baseHeaders }, state);
      const item2 = rItem2.ok ? await rItem2.json() : {};

      const aindaTemPromocao = promocoesRestantes.length > 0;

      log('🎯 Verificação final:');
      log(`   Promoções restantes: ${promocoesRestantes.length}`);
      log(`   Preço antes: ${itemData.price}`);
      log(`   Preço depois: ${item2.price}`);

      return {
        success: resultadoRemocao.sucesso || !aindaTemPromocao,
        message: (resultadoRemocao.sucesso || !aindaTemPromocao)
          ? 'Promoções processadas com sucesso'
          : 'Algumas promoções não puderam ser removidas',
        mlb_id: mlbId,
        titulo: itemData.title,
        preco_antes: itemData.price,
        preco_depois: item2.price,
        preco_original_antes: itemData.original_price,
        preco_original_depois: item2.original_price,
        tinha_promocao: true,
        ainda_tem_promocao: aindaTemPromocao,
        metodos_tentados: resultadoRemocao.metodos_tentados,
        promocoes_encontradas: ativas.map(p => `${p.type} - ${p.status}`),
        promocoes_removidas: resultadoRemocao.promocoes_removidas,
        promocoes_com_erro: resultadoRemocao.promocoes_com_erro,
        promocoes_restantes: promocoesRestantes.map(p => `${p.type} - ${p.status}`)
      };

    } catch (error) {
      (optionsOrState.logger || console).error(`❌ [${(optionsOrState?.key || optionsOrState?.accountKey || 'sem-conta')}] Erro ao processar ${mlbId}:`, error?.message || error);
      return {
        success: false,
        message: error?.message || String(error),
        mlb_id: mlbId,
        error: true
      };
    }
  }

  /**
   * Processa um lote, reutilizando UM token e renovando apenas se 401.
   * @param {string} processId
   * @param {string[]} mlbIds
   * @param {number} delay - delay entre itens (ms)
   * @param {object} processamentosRemocao - dicionário de status
   * @param {object} options - { mlCreds?, accountKey?, logger? }
   */
  static async processarRemocaoLote(processId, mlbIds, delay, processamentosRemocao, options = {}) {
    const logger = options.logger || console;
    const status = processamentosRemocao[processId];
    try {
      // monta state uma vez (garante prefixo de log com a conta correta)
      const state = await prepararAuthState(options);

      status.status = 'processando';
      logger.log(`🚀 [${state.key}] Iniciando processamento em lote: ${mlbIds.length} anúncios`);

      for (let i = 0; i < mlbIds.length; i++) {
        const mlbId = String(mlbIds[i] || '').trim();
        if (!mlbId) continue;

        try {
          logger.log(`📋 [${state.key}] Processando ${i + 1}/${mlbIds.length}: ${mlbId}`);

          // passa o MESMO state para não renovar a cada item
          const resultado = await this.removerPromocaoUnico(mlbId, state);

          status.resultados.push(resultado);
          if (resultado.success) status.sucessos++;
          else status.erros++;
        } catch (error) {
          logger.error(`❌ [${state.key}] Erro ao processar ${mlbId}:`, error?.message || error);
          status.erros++;
          status.resultados.push({
            success: false,
            mlb_id: mlbId,
            message: error?.message || String(error),
            error: true
          });
        }

        status.processados++;
        status.progresso = Math.round((status.processados / status.total_anuncios) * 100);

        if (i < mlbIds.length - 1 && delay > 0) {
          logger.log(`⏳ [${state.key}] Aguardando ${delay}ms antes do próximo...`);
          await sleep(delay);
        }
      }

      status.status = 'concluido';
      status.concluido_em = new Date();
      logger.log(`✅ [${state.key}] Processamento concluído: ${status.sucessos} sucessos, ${status.erros} erros`);
    } catch (e) {
      // Falha antes do loop (ex.: token/credenciais): garante finalizar o status
      status.status = 'erro';
      status.concluido_em = new Date();
      status.progresso = Math.round((status.processados / status.total_anuncios) * 100);
      logger.error(`❌ [bulk] Falha inicial no processamento:`, e?.message || e);
    }
  }
}

module.exports = PromocaoService;
