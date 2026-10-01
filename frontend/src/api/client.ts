const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || '';
export const BASE = `${API_ORIGIN}/api`;

export async function request<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (!(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  
  const res = await fetch(BASE + path, { ...opts, headers });
  
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
    throw new Error('Phiên đăng nhập hết hạn');
  }
  if (res.status === 404) {
    const err = await res.json().catch(() => null);
    if (err && err.detail) {
      throw new Error(err.detail);
    }
    throw new Error(`API không tồn tại: ${path}. Kiểm tra backend ${API_ORIGIN} đã chạy bản mới chưa.`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    let detailMsg = 'Request failed';
    if (Array.isArray(err?.detail)) {
      detailMsg = err.detail.map((d: any) => `${d.loc ? d.loc.slice(-1)[0] : ''}: ${d.msg}`).join(', ');
    } else if (typeof err?.detail === 'string') {
      detailMsg = err.detail;
    }
    throw new Error(detailMsg);
  }
  if (res.status === 204) return null as unknown as T;
  return res.json();
}

export const json = (body: unknown) => JSON.stringify(body);
