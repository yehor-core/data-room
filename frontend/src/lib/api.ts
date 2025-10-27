import axios from 'axios';
import { supabase } from './supabase';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

console.log('🔗 [API] Base URL configured:', API_URL);
console.log('🔗 [API] Environment variable REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  async (config) => {
    // Get the current session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      console.log('🔑 [API] Adding Supabase access token to request');
      config.headers.Authorization = `Bearer ${session.access_token}`;
    } else {
      console.log('⚠️ [API] No Supabase session found');
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors with comprehensive logging
api.interceptors.response.use(
  (response) => {
    console.log('✅ [API] Response received:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ [API] Request failed:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code
    });

    // Handle different types of errors
    if (error.response?.status === 401) {
      console.log('🔐 [API] Unauthorized - clearing tokens');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Note: Let the PrivateRoute component handle redirect to login
      // Avoid using window.location.href to prevent redirect loops
    } else if (error.response?.status === 404) {
      console.error('🔍 [API] Endpoint not found - check if backend is deployed correctly');
    } else if (error.response?.status === 403) {
      console.error('🚫 [API] Forbidden - check CORS configuration');
    } else if (error.code === 'ERR_NETWORK') {
      console.error('🌐 [API] Network error - check if backend is accessible');
    } else if (error.code === 'ERR_CANCELED') {
      console.error('⏹️ [API] Request was canceled');
    }

    return Promise.reject(error);
  }
);

export default api;

