// Every request to the backend goes through here.
// In dev, Vite proxies /api to localhost:4000. In production the API is served on
// the same domain under /api. Set VITE_API_URL only if the API lives elsewhere.
const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "vitron_token";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details || null;
  }
}

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
};

export async function api(path, { method = "GET", body, form, timeout = 20000, signal } = {}) {
  const headers = { accept: "application/json" };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;

  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }

  // Never let a request hang forever.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), timeout);
  signal?.addEventListener("abort", () => ctrl.abort(signal.reason));

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload, signal: ctrl.signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    if (err?.name === "TimeoutError" || ctrl.signal.reason?.name === "TimeoutError") {
      throw new ApiError("The server took too long to respond. Check your connection and try again.", 0);
    }
    throw new ApiError("Can't reach the server. Check your internet connection and try again.", 0);
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { /* non-JSON error page */ }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event("vitron:signed-out"));
    }
    const message = data?.error || (res.status >= 500 ? "Something went wrong on our side. Please try again." : `Request failed (${res.status})`);
    throw new ApiError(message, res.status, data?.details);
  }
  return data;
}

/** Turn an object into a query string, skipping empty values. */
export function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== "" && v !== false) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
