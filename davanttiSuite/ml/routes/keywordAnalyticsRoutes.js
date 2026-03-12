const express = require("express");
const router = express.Router();
const KeywordAnalyticsController = require("../controllers/keywordAnalyticsController");
const ensurePermission = require("../middleware/ensurePermission");

// Middleware para adicionar timestamp de início (útil para tempo de processamento)
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Middleware de logging para esta seção
router.use((req, res, next) => {
  console.log(
    `📊 Keyword Analytics Request: ${req.method} ${req.path} - ${new Date().toISOString()}`,
  );
  next();
});

// GET /api/keyword-analytics/trends - Busca palavras-chave relacionadas e tendências
router.get("/trends", KeywordAnalyticsController.getKeywordTrends);

// GET /api/keyword-analytics/suggest - Sugestões e análise de keywords (ML + Trends)
router.get("/suggest", KeywordAnalyticsController.getSuggestions);

// GET /api/keyword-analytics/debug-context - somente admin/master
router.get(
  "/debug-context",
  ensurePermission.requireAdmin(),
  KeywordAnalyticsController.debugContext,
);

// POST /api/keyword-analytics/clear-cache - Limpar cache específico
router.post("/clear-cache", KeywordAnalyticsController.clearKeywordCache);

// POST /api/keyword-analytics/apply-title - Aplicar novo título no ML (proteção admin)
router.post(
  "/apply-title",
  ensurePermission.requireAdmin(),
  KeywordAnalyticsController.applyTitle,
);

// Middleware de tratamento de erros específico para estas rotas
router.use((error, req, res, next) => {
  console.error("❌ Erro nas rotas de keyword analytics:", error);
  res.status(500).json({
    success: false,
    message: "Erro interno do servidor nas rotas de keyword analytics",
    error: error.message,
    timestamp: new Date().toISOString(),
    path: req.path,
  });
});

module.exports = router;
