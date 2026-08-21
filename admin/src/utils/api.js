// Единственная точка запросов к бэку. Голый fetch в компонентах запрещён.
// Бэкенд отвечает в формате { ok: true, data } | { ok: false, error: { code, message } }.
import { API_URL } from './constants.js';

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function buildUrl(path, query) {
  if (!query) return `${API_URL}${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const search = params.toString();
  return `${API_URL}${path}${search ? `?${search}` : ''}`;
}

async function request(path, { method = 'GET', body, query, form, timeout = 30_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (body ? JSON.stringify(body) : undefined),
      credentials: 'include',
      signal: controller.signal,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.ok === false) {
      throw new ApiError(json?.error?.message ?? `HTTP ${response.status}`, {
        status: response.status,
        code: json?.error?.code,
      });
    }
    return json?.data ?? json;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: (path, query, options) => request(path, { ...options, query }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', form: formData }),
  // Файл выгрузки скачивается напрямую: ответ не JSON.
  downloadUrl: (path, query) => buildUrl(path, query),
};
