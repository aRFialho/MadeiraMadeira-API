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
const MarginController = require("../controllers/MarginController");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

if (process.env.ENABLE_DEBUG_ROUTES === "true") {
  router.use(debugRoutes);
}

router.use(require("./seo"));
router.use(sessionRoutes);

// sessionAuth para rotas protegidas e auth
router.use(sessionAuth);

// Auth routes
router.use(healthRoutes);
router.use(authLocalRoutes);
router.use(authRoutes);

// Rotas protegidas
router.use(require("./seo.authed"));
router.use(adminRoutes);
router.use(ordersRoutes);
router.use(productsRoutes);
router.use(adsRoutes);
router.get(
  "/dashboard/margin",
  sessionAuth,
  asyncHandler(MarginController.getMarginData),
);

module.exports = router;
