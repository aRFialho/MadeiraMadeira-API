import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// Use full API URL in production, relative path in development
// Force correct URL by ignoring env var if it points to the frontend itself (common misconfiguration)
let API_URL = import.meta.env.VITE_API_URL || 'https://madeiramadeira-api.onrender.com';

// Safety check: if API_URL contains 'madeiramadeira-web', it's wrong (pointing to frontend).
// Force it to backend.
if (API_URL.includes('madeiramadeira-web.onrender.com')) {
  API_URL = 'https://madeiramadeira-api.onrender.com';
}

const baseURL = `${API_URL}/api`;

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
