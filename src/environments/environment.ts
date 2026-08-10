/**
 * Development environment values. `apiBaseUrl` points directly at the PWR
 * backend's HTTPS dev port — the backend has no CORS policy configured, so
 * calls from `ng serve` (localhost:4200) will be blocked by the browser
 * unless the backend adds one. proxy.conf.json offers a CORS-free
 * alternative (point apiBaseUrl at '/api' instead) if that's preferred.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'https://localhost:44372/api',
};
