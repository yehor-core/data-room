import axios from 'axios';
import { toast } from './toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

let token: string | null = null;

export const setAuthToken = (newToken: string | null) => {
  token = newToken;
};

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      toast.error('Unable to connect to the server. Please check your internet connection.');
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      toast.error('The request timed out. Please try again.');
    }

    return Promise.reject(error);
  },
);

export const getFileUrl = (fileId: string) => {
  return api.get(`/files/${fileId}/view`, {
    maxRedirects: 0,
    validateStatus: function (status) {
      return status >= 200 && status < 400;
    },
  });
};
