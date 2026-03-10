import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// Use full API URL in production, relative path in development
const API_URL = import.meta.env.VITE_API_URL || 'https://madeiramadeira-api.onrender.com';
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
