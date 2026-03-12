"use strict";

const express = require("express");
const PrazoProducaoController = require("../controllers/PrazoProducaoController");

const router = express.Router();

// Individual
router.post(
  "/anuncio/prazo-producao",
  PrazoProducaoController.setPrazoProducaoSingle
);

// Lote (novo)
router.post(
  "/anuncios/prazo-producao-lote",
  PrazoProducaoController.setPrazoProducaoLote
);

// ✅ Compat LEGADO (prazo-bulk.js antigo)
// - POST /anuncios/prazo-dias-lote      -> body { mlb_ids, days, delay_ms }
// - GET  /anuncios/status-prazo/:id
router.post("/anuncios/prazo-dias-lote", (req, res, next) => {
  // normaliza payload legado -> novo
  const b = req.body || {};
  if (b && b.delay_ms != null && b.delayMs == null) {
    b.delayMs = b.delay_ms;
  }
  req.body = b;
  return PrazoProducaoController.setPrazoProducaoLote(req, res, next);
});

// Status (pra JobsPanel / monitor)
router.get(
  "/anuncios/status-prazo-producao/:id",
  PrazoProducaoController.statusPrazoProducao
);

// ✅ Compat LEGADO
router.get("/anuncios/status-prazo/:id", PrazoProducaoController.statusPrazoProducao);

module.exports = router;
