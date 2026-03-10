// API Configuration
let API_BASE_URL = import.meta.env.VITE_API_URL || 'https://madeiramadeira-api.onrender.com';

// Safety check: if API_URL contains 'madeiramadeira-web', it's wrong (pointing to frontend).
if (API_BASE_URL.includes('madeiramadeira-web.onrender.com')) {
  API_BASE_URL = 'https://madeiramadeira-api.onrender.com';
}

export const apiConfig = {
  baseURL: API_BASE_URL,
  endpoints: {
    auth: `${API_BASE_URL}/api/auth`,
    marketplace: `${API_BASE_URL}/api/marketplace`,
    health: `${API_BASE_URL}/health`,
  },
};

export default apiConfig;
