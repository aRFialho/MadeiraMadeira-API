import { Request, Response } from 'express';
import marketplaceService from '../services/MarketplaceService';
import dashboardService from '../services/DashboardService';

export class MarketplaceController {
  async getProducts(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      
      // limit and offset are handled internally in MarketplaceService now
      const products = await marketplaceService.fetchProducts(userId);
      res.json({ data: products, count: products.length });
    } catch (error: any) {
      console.error('Get products error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getOrders(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;

      // limit and offset are handled internally in MarketplaceService now
      const orders = await marketplaceService.fetchOrders(userId);
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

      // Update method signature mismatch fix:
      // The service likely expects (sku, productData) without userId if it's not using it,
      // OR the controller is passing arguments incorrectly.
      // Checking service definition: updateProduct(sku: string, data: Partial<Product>)
      // So userId is NOT needed.
      await marketplaceService.updateProduct(sku, productData);
      
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

      // Update method signature mismatch fix:
      // Checking service definition: updateOrderStatus(orderId: number, status: string)
      // So userId is NOT needed.
      await marketplaceService.updateOrderStatus(parseInt(orderId), status);
      
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
