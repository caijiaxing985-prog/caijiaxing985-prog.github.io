import { sitePath } from './paths.js';

export async function api(url, options = {}) {
  const response = await fetch(sitePath(url), { credentials: 'same-origin', cache: 'no-store', ...options,
    headers: { 'X-Library-Request': '1', ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || '服务连接失败，请稍后重试'), { status: response.status });
  return data;
}
