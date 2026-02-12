import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Add API key to every request
api.interceptors.request.use((config) => {
  const key = localStorage.getItem('api_key');
  if (key) config.headers['X-API-Key'] = key;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('api_key');
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export default api;
