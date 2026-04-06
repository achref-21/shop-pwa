//const API_BASE = "https://shop-app-dep.onrender.com/api";
const API_BASE = "http://localhost:8000/api";

export class ApiHttpError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string, statusText: string) {
    super(body || statusText || `HTTP ${status}`);
    this.name = "ApiHttpError";
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiHttpError(res.status, text, res.statusText);
  }

  return res.json();
}
