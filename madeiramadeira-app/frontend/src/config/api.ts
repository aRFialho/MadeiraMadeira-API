// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const apiConfig = {
  baseURL: API_BASE_URL,
  endpoints: {
    auth: `${API_BASE_URL}/api/auth`,
    marketplace: `${API_BASE_URL}/api/marketplace`,
    health: `${API_BASE_URL}/health`,
  },
};

export default apiConfig;
