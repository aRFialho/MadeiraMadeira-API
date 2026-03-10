import { Router } from 'express';
import { marketplaceController, dashboardController } from '../controllers/MarketplaceController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Products
router.get('/products', (req, res) => marketplaceController.getProducts(req, res));
router.put('/products/:sku', (req, res) => marketplaceController.updateProduct(req, res));

// Orders
router.get('/orders', (req, res) => marketplaceController.getOrders(req, res));
router.get('/orders/:orderId/detail', (req, res) => marketplaceController.getOrderDetail(req, res));
router.put('/orders/:orderId/status', (req, res) => marketplaceController.updateOrderStatus(req, res));

// Dashboard
router.get('/dashboard/metrics', (req, res) => dashboardController.getMetrics(req, res));
router.get('/dashboard/chart', (req, res) => dashboardController.getSalesChart(req, res));

export default router;
