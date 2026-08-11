function resolveApiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== "undefined" && /\.vercel\.app$/i.test(window.location.hostname)) {
    return "https://work-next-server.vercel.app/api";
  }

  return "http://localhost:4000/api";
}

const TOKEN_KEY = "worknest_token";
const USER_KEY = "worknest_user";
const getCache = new Map();
const GET_CACHE_TTL_MS = 8000;

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  getCache.clear();
}

export function getCachedUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user) {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function buildUrl(path, query) {
  const url = new URL(`${resolveApiUrl()}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

export function invalidateApiCache() {
  getCache.clear();
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = buildUrl(path, options.query);

  if (method === "GET" && !options.skipCache) {
    const hit = getCache.get(url);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.data;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.message || "Request failed",
      payload.errors || payload.details
    );
  }

  const data = payload.data ?? payload;

  if (method === "GET") {
    getCache.set(url, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS });
  } else {
    getCache.clear();
  }

  return data;
}

export const api = {
  get: (path, query, opts) => request(path, { query, ...opts }),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};

export async function getPaginated(path, query) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = buildUrl(path, query);
  const hit = getCache.get(url);
  if (hit && hit.expiresAt > Date.now() && hit.paginated) {
    return hit.data;
  }

  const response = await fetch(url, { headers });
  const payload = await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, payload.message || "Request failed");
  }

  const data = { data: payload.data, meta: payload.meta };
  getCache.set(url, {
    data,
    paginated: true,
    expiresAt: Date.now() + GET_CACHE_TTL_MS,
  });
  return data;
}
