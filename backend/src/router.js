// Minimal router: route("GET", "/api/products/:slug", handler)
// Handlers receive (ctx) => Response | object. Plain objects are sent as JSON.

export function createRouter() {
  const routes = [];

  function add(method, path, handler) {
    const keys = [];
    const pattern = path.replace(/\/:([a-zA-Z_]+)/g, (_, k) => {
      keys.push(k);
      return "/([^/]+)";
    });
    routes.push({ method, regex: new RegExp(`^${pattern}/?$`), keys, handler });
  }

  function match(method, pathname) {
    let pathMatched = false;
    for (const r of routes) {
      const m = pathname.match(r.regex);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }

  return {
    get: (p, h) => add("GET", p, h),
    post: (p, h) => add("POST", p, h),
    put: (p, h) => add("PUT", p, h),
    patch: (p, h) => add("PATCH", p, h),
    delete: (p, h) => add("DELETE", p, h),
    match,
  };
}
