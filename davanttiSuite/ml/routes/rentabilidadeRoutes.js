"use strict";

const express = require("express");
const RentabilidadeController = require("../controllers/RentabilidadeController");

const router = express.Router();
router.get("/overview", RentabilidadeController.overview);
router.post("/config/:itemId", RentabilidadeController.saveConfig);
router.get("/config/:itemId/history", RentabilidadeController.history);
router.post("/import-configs", RentabilidadeController.importConfigs);
module.exports = router;
