"use strict";

const RentabilidadeService = require("../services/rentabilidadeService");

function getUserId(req) {
  const raw = req.user?.uid ?? req.user?.id ?? req.user?.user_id ?? null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

module.exports = {
  async overview(req, res) {
    try {
      const filters = RentabilidadeService.resolveFilters(req.query || {});
      const { mlCreds, accountKey } = res.locals;
      const result = await RentabilidadeService.obterOverview(filters, { mlCreds, accountKey });
      if (!result?.success) {
        return res.status(502).json({ success: false, error: result?.error || "Falha ao carregar rentabilidade.", code: result?.code || "RENTABILIDADE_ERROR" });
      }
      return res.json(result);
    } catch (error) {
      console.error("Erro em RentabilidadeController.overview:", error);
      return res.status(500).json({ success: false, error: error?.message || "Erro interno ao carregar rentabilidade." });
    }
  },

  async saveConfig(req, res) {
    try {
      const itemId = String(req.params.itemId || "").trim();
      if (!itemId) return res.status(400).json({ success: false, error: "itemId é obrigatório." });
      const payload = await RentabilidadeService.salvarConfiguracao({
        accountKey: res.locals.accountKey,
        sellerId: req.user_data?.user_id || null,
        itemId,
        custo_produto_unitario: req.body?.custo_produto_unitario,
        aliquota: req.body?.aliquota,
        userId: getUserId(req),
      });
      return res.json(payload);
    } catch (error) {
      console.error("Erro em RentabilidadeController.saveConfig:", error);
      return res.status(500).json({ success: false, error: error?.message || "Falha ao salvar configuração." });
    }
  },

  async history(req, res) {
    try {
      const itemId = String(req.params.itemId || "").trim();
      const result = await RentabilidadeService.historicoConfiguracao({ accountKey: res.locals.accountKey, itemId, limit: req.query?.limit });
      return res.json(result);
    } catch (error) {
      console.error("Erro em RentabilidadeController.history:", error);
      return res.status(500).json({ success: false, error: error?.message || "Falha ao carregar histórico." });
    }
  },

  async importConfigs(req, res) {
    try {
      const result = await RentabilidadeService.importarConfiguracoes({
        accountKey: res.locals.accountKey,
        sellerId: req.user_data?.user_id || null,
        filename: req.body?.filename,
        content_base64: req.body?.content_base64,
        userId: getUserId(req),
      });
      return res.json(result);
    } catch (error) {
      console.error("Erro em RentabilidadeController.importConfigs:", error);
      return res.status(500).json({ success: false, error: error?.message || "Falha ao importar planilha." });
    }
  },
};
