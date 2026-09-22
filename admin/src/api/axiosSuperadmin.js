import axios from 'axios';

const superadminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

superadminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('superadmin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

superadminApi.interceptors.response.use(
  response => response,
  error => {
    const esLogin = error.config?.url?.includes('/login');
    if (!esLogin && (error.response?.status === 401 || error.response?.status === 403)) {
      localStorage.removeItem('superadmin_token');
      window.location.href = '/superadmin';
    }
    return Promise.reject(error);
  }
);

export default superadminApi;
