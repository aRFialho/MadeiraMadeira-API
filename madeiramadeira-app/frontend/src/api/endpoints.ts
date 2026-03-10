import apiClient from './client';
import { Dashboard, Order, Product, SalesData } from '../types';

export const authApi = {
  register: (username: string, email: string, password: string) =>
    apiClient.post('/auth/register', { username, email, password }),
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),
};

export const marketplaceApi = {
  // Products
  getProducts: (limit = 100, offset = 0) =>
    apiClient.get<{ data: Product[]; count: number }>('/marketplace/products', {
      params: { limit, offset },
    }),
  updateProduct: (sku: string, data: Partial<Product>) =>
    apiClient.put(`/marketplace/products/${sku}`, data),

  // Orders
  getOrders: (limit = 100, offset = 0) =>
    apiClient.get<{ data: Order[]; count: number }>('/marketplace/orders', {
      params: { limit, offset },
    }),
  getOrderDetail: (orderId: number) =>
    apiClient.get(`/marketplace/orders/${orderId}/detail`),
  updateOrderStatus: (orderId: number, status: string) =>
    apiClient.put(`/marketplace/orders/${orderId}/status`, { status }),
};

export const dashboardApi = {
  getMetrics: () =>
    apiClient.get<Dashboard>('/marketplace/dashboard/metrics'),
  getSalesChart: (days = 30) =>
    apiClient.get<SalesData[]>('/marketplace/dashboard/chart', {
      params: { days },
    }),
};
