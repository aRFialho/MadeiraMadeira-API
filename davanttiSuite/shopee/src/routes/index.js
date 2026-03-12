// shopee/src/routes/index.js
const express = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const authLocalRoutes = require("./authLocal.routes");
const sessionRoutes = require("./session.routes");
const ordersRoutes = require("./orders.routes");
const productsRoutes = require("./products.routes");
const debugRoutes = require("./debug.routes");
const adminRoutes = require("./admin.routes");
const { sessionAuth } = require("../middlewares/sessionAuth");
const adsRoutes = require("./ads.routes");

const router = express.Router();

if (process.env.ENABLE_DEBUG_ROUTES === "true") {
  router.use(debugRoutes);
}

router.use(require("./seo"));
router.use(sessionRoutes);

// Auth routes ANTES do sessionAuth
router.use(healthRoutes);
router.use(authLocalRoutes);
router.use(authRoutes);

// sessionAuth para rotas protegidas
router.use(sessionAuth);

// Rotas protegidas
router.use(require("./seo.authed"));
router.use(adminRoutes);
router.use(ordersRoutes);
router.use(productsRoutes);
router.use(adsRoutes);

module.exports = router;
