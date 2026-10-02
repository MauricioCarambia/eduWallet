import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    // Solo se cierra la sesión si el servidor dice que la sesión no sirve (401) en
    // un pedido que la llevaba. Un 403 es algo que no se puede hacer (se muestra
    // el error y se sigue) y un 401 del login es clave incorrecta (se muestra).
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_sesion');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;