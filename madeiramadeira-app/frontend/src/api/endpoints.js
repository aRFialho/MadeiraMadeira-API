import apiClient from './client';
export const authApi = {
    register: (username, email, password) => apiClient.post('/auth/register', { username, email, password }),
    login: (username, password) => apiClient.post('/auth/login', { username, password }),
};
export const marketplaceApi = {
    getProducts: (limit = 100, offset = 0) => apiClient.get('/marketplace/products', {
        params: { limit, offset },
    }),
    getOrders: (limit = 100, offset = 0) => apiClient.get('/marketplace/orders', {
        params: { limit, offset },
    }),
    updateProduct: (sku, data) => apiClient.put(`/marketplace/products/${sku}`, data),
    updateOrderStatus: (orderId, status) => apiClient.put(`/marketplace/orders/${orderId}/status`, { status }),
};
export const dashboardApi = {
    getMetrics: () => apiClient.get('/marketplace/dashboard/metrics'),
    getSalesChart: (days = 30) => apiClient.get('/marketplace/dashboard/chart', {
        params: { days },
    }),
};
