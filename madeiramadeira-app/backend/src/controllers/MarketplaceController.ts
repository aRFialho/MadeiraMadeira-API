import { Request, Response } from 'express';
import marketplaceService from '../services/MarketplaceService';
import dashboardService from '../services/DashboardService';

export class MarketplaceController {
  async getProducts(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const products = await marketplaceService.fetchProducts(userId, limit, offset);
      res.json({ data: products, count: products.length });
    } catch (error: any) {
      console.error('Get products error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getOrders(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const orders = await marketplaceService.fetchOrders(userId, limit, offset);
      res.json({ data: orders, count: orders.length });
    } catch (error: any) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getOrderDetail(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const orderId = parseInt(req.params.orderId);

      if (!orderId || isNaN(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID' });
      }

      const orderDetail = await marketplaceService.getOrderDetail(userId, orderId);
      res.json(orderDetail);
    } catch (error: any) {
      console.error('Get order detail error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateProduct(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { sku } = req.params;
      const productData = req.body;

      await marketplaceService.updateProduct(userId, sku, productData);
      res.json({ message: 'Product updated successfully' });
    } catch (error: any) {
      console.error('Update product error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateOrderStatus(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { orderId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      await marketplaceService.updateOrderStatus(userId, parseInt(orderId), status);
      res.json({ message: 'Order status updated successfully' });
    } catch (error: any) {
      console.error('Update order status error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export class DashboardController {
  async getMetrics(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const metrics = await dashboardService.getDashboardMetrics(userId);
      res.json(metrics);
    } catch (error: any) {
      console.error('Get metrics error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getSalesChart(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const days = parseInt(req.query.days as string) || 30;

      const chartData = await dashboardService.getSalesChart(userId, days);
      res.json(chartData);
    } catch (error: any) {
      console.error('Get chart error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const marketplaceController = new MarketplaceController();
export const dashboardController = new DashboardController();
