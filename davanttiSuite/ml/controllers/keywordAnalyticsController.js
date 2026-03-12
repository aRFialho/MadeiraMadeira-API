const KeywordAnalyticsService = require("../services/keywordAnalyticsService");
const EditarAnuncioService = require("../services/editarAnuncioService");
const TokenService = require("../services/tokenService");

class KeywordAnalyticsController {
  /**
   * Busca palavras-chave relacionadas e tendências.
   * @param {Object} req Objeto de requisição.
   * @param {Object} res Objeto de resposta.
   */
  static async getKeywordTrends(req, res) {
    try {
      const { keyword } = req.query; // 'source' não é mais necessário aqui, pois só teremos Trends

      if (!keyword || keyword.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "A palavra-chave é obrigatória.",
        });
      }

      console.log(
        `🔍 Requisição de tendência de palavra-chave: "${keyword}" (Google Trends)`,
      ); // Log ajustado

      // Chamada direta para o Google Trends, sem a necessidade de um 'switch' de fonte
      const results =
        await KeywordAnalyticsService.getGoogleTrendsKeywordData(keyword);

      // Adicionar metadados da requisição
      results.request_info = {
        keyword_solicitada: keyword,
        fonte_solicitada: "Google Trends", // Fonte fixa agora
        timestamp: new Date().toISOString(),
        tempo_processamento: Date.now() - req.startTime,
      };

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("❌ Erro no KeywordAnalyticsController:", error.message);
      res.status(500).json({
        success: false,
        message:
          "Erro interno do servidor ao buscar tendências de palavra-chave.",
        error: error.message,
      });
    }
  }

  static async getSuggestions(req, res) {
    try {
      const item_id = String(req.query.item_id || "")
        .toUpperCase()
        .trim();
      const seed = String(req.query.seed || "").trim() || null;
      const limit = Math.min(
        200,
        Math.max(1, parseInt(req.query.limit || "25", 10)),
      );
      const pages = Math.min(
        10,
        Math.max(1, parseInt(req.query.pages || "5", 10)),
      );
      const site = String(req.query.site || "MLB")
        .trim()
        .toUpperCase();
      if (!/^ML[A-Z]\d{6,}$/.test(item_id)) {
        return res
          .status(400)
          .json({ success: false, message: "item_id inválido" });
      }
      const mlCreds = res?.locals?.mlCreds || null;
      if (!mlCreds?.meli_conta_id) {
        console.warn("KA suggest account missing", {
          account: {
            id: res?.locals?.mlCreds?.meli_conta_id || null,
            key: res?.locals?.accountKey || null,
            label: res?.locals?.accountLabel || null,
          },
        });
        return res.status(401).json({
          success: false,
          code: "ML_AUTH_INVALID",
          message:
            "Conta Mercado Livre não selecionada ou sessão inválida. Selecione/reautentique a conta e tente novamente.",
          redirect: "/ml/select-conta",
        });
      }
      const out = await KeywordAnalyticsService.computeSuggestions({
        item_id,
        seed,
        limit,
        pages,
        site,
        mlCreds,
        accountKey: res?.locals?.accountKey || null,
      });
      console.log("KA suggest ok", {
        account: {
          id: res?.locals?.mlCreds?.meli_conta_id || null,
          key: res?.locals?.accountKey || null,
          label: res?.locals?.accountLabel || null,
        },
        endpoint: "/items, /search, /trends",
        status: 200,
      });
      res.json({ success: true, ...out });
    } catch (error) {
      const status = error?.statusCode || 500;
      if (status === 401 || status === 403) {
        console.warn("KA suggest ML error", {
          account: {
            id: res?.locals?.mlCreds?.meli_conta_id || null,
            key: res?.locals?.accountKey || null,
            label: res?.locals?.accountLabel || null,
          },
          endpoint: error?.endpoint,
          status,
          code: error?.code || null,
          message: error?.message,
        });

        // Erros específicos (mais úteis que "token inválido" genérico)
        if (error?.code === "ML_AUTH_INVALID") {
          return res.status(401).json({
            success: false,
            code: "ML_AUTH_INVALID",
            message:
              "Token inválido/expirado para a conta selecionada. Reautentique a conta Mercado Livre.",
            endpoint: error?.endpoint || null,
          });
        }

        if (error?.code === "ML_ITEM_NOT_OWNED") {
          return res.status(403).json({
            success: false,
            code: "ML_ITEM_NOT_OWNED",
            message:
              "Esse MLB não pertence à conta selecionada. Troque a conta e tente novamente.",
            endpoint: error?.endpoint || null,
          });
        }

        // fallback genérico
        return res.status(status).json({
          success: false,
          code: "ML_AUTH_INVALID",
          message:
            "Token inválido/expirado para a conta selecionada. Reautentique a conta Mercado Livre.",
          endpoint: error?.endpoint || null,
        });
      }

if (status === 429) {
        console.warn("KA suggest ML rate limit", {
          endpoint: error?.endpoint,
          status,
          message: error?.message,
        });
        return res.status(429).json({
          success: false,
          code: "ML_RATE_LIMIT",
          message: "Rate limit. Tente em alguns minutos.",
        });
      }
      console.error("KA suggest error", {
        endpoint: error?.endpoint,
        status,
        message: error?.message,
      });
      res.status(500).json({
        success: false,
        message: "Erro interno do servidor ao gerar sugestões.",
        error: "internal_error",
      });
    }
  }

  static async debugContext(req, res) {
    try {
      const hasReqMl = !!(req?.ml);
      const hasToken = !!(req?.ml?.accessToken || res?.locals?.mlCreds?.access_token);
      let sellerId = null, nickname = null;
      try {
        const t = await TokenService.testarToken(res?.locals?.mlCreds || {});
        if (t?.success) { sellerId = t.user_id || null; nickname = t.nickname || null; }
      } catch {}
      return res.json({
        ok: true,
        success: true,
        context: {
          hasReqMl,
          hasToken,
          accountId: res?.locals?.mlCreds?.meli_conta_id || null,
          accountLabel: res?.locals?.accountLabel || null,
          sellerId,
          nickname,
        },
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e?.message || 'debug-failed' });
    }
  }

  static async applyTitle(req, res) {
    try {
      const item_id = String(req.body?.item_id || "")
        .toUpperCase()
        .trim();
      const new_title = String(req.body?.new_title || "").trim();
      if (!/^ML[A-Z]\d{6,}$/.test(item_id)) {
        return res
          .status(400)
          .json({ success: false, message: "item_id inválido" });
      }
      if (!new_title) {
        return res
          .status(400)
          .json({ success: false, message: "Título vazio" });
      }
      const accessToken =
        req?.ml?.accessToken || res?.locals?.mlCreds?.access_token || null;
      if (!accessToken) {
        return res
          .status(401)
          .json({ success: false, message: "Token ML indisponível" });
      }
      const updated = await EditarAnuncioService.updateItem({
        mlb: item_id,
        accessToken,
        patch: { title: new_title },
      });
      res.json({
        success: true,
        item_id,
        title: updated?.title || new_title,
        updated,
      });
    } catch (error) {
      const status = error?.statusCode || 500;
      res.status(status).json({
        success: false,
        message: error?.message || "Erro ao aplicar título no ML",
        details: error?.details || null,
      });
    }
  }

  /**
   * Limpa o cache.
   * @param {Object} req Objeto de requisição.
   * @param {Object} res Objeto de resposta.
   */
  static async clearKeywordCache(req, res) {
    try {
      KeywordAnalyticsService.clearCache();
      res.json({
        success: true,
        message: "Cache de palavras-chave limpo com sucesso!",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "❌ Erro ao limpar cache de palavras-chave:",
        error.message,
      );
      res.status(500).json({
        success: false,
        message: "Erro ao limpar cache de palavras-chave.",
        error: error.message,
      });
    }
  }
}

module.exports = KeywordAnalyticsController;
