import axios from 'axios';
import { marcarRed, esErrorDeRed } from '../offline/estado';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Cada respuesta dice si hay conexión con el servidor (para el modo offline)
api.interceptors.response.use(
  response => { marcarRed(true); return response },
  error => {
    marcarRed(!esErrorDeRed(error));
    // Sólo los errores de sesión cierran la sesión; un 403 del negocio (QR bloqueado por la
    // familia, regla de compra, producto de otra zona) se muestra y el cajero sigue
    const status = error.response?.status;
    const deSesion = status === 401 || (status === 403 && /token|acceso restringido|no operan el POS/i.test(error.response?.data?.error || ''));
    if (deSesion) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_sesion');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;