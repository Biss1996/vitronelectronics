import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../lib/api.js";
import { toast } from "../lib/toast.js";

const read = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full / private mode */ }
};

/* ---------------- Auth ---------------- */
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? read("vitron_user", null) : null));
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  const saveSession = useCallback((u, token) => {
    if (token) setToken(token);
    setUser(u);
    write("vitron_user", u);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    try { localStorage.removeItem("vitron_user"); } catch { /* ignore */ }
  }, []);

  // Refresh the user (role and permissions may have changed) when the app opens.
  useEffect(() => {
    if (!getToken()) return;
    api("/api/auth/me")
      .then((d) => saveSession(d.user))
      .catch((e) => { if (e.status === 401) logout(); })
      .finally(() => setLoading(false));
  }, [saveSession, logout]);

  // Any 401 from the API signs the user out.
  useEffect(() => {
    const onOut = () => { setUser(null); try { localStorage.removeItem("vitron_user"); } catch { /* ignore */ } };
    window.addEventListener("vitron:signed-out", onOut);
    return () => window.removeEventListener("vitron:signed-out", onOut);
  }, []);

  const login = useCallback(async (phone, password) => {
    const d = await api("/api/auth/login", { method: "POST", body: { phone, password } });
    saveSession(d.user, d.token);
    return d.user;
  }, [saveSession]);

  const register = useCallback(async (payload) => {
    const d = await api("/api/auth/register", { method: "POST", body: payload });
    saveSession(d.user, d.token);
    return d.user;
  }, [saveSession]);

  const can = useCallback((permission) => Boolean(user?.permissions?.includes(permission)), [user]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, saveSession, can, isStaff: can("dashboard:view") }),
    [user, loading, login, register, logout, saveSession, can],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ---------------- Cart ---------------- */
// Prices in the cart are for display only — the server re-prices every order.
const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

const itemKey = (productId, variantId) => `${productId}:${variantId || ""}`;

function CartProvider({ children }) {
  const [items, setItems] = useState(() => read("vitron_cart", []));
  const [open, setOpen] = useState(false);

  useEffect(() => write("vitron_cart", items), [items]);

  const add = useCallback((product, { variant = null, quantity = 1, silent = false } = {}) => {
    const key = itemKey(product.id, variant?.id);
    const max = Math.min(20, variant ? variant.stock : product.stock);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(max, i.quantity + quantity), maxQty: max } : i));
      }
      return [...prev, {
        key,
        productId: product.id,
        variantId: variant?.id || null,
        slug: product.slug,
        name: product.name,
        variantLabel: variant?.label || null,
        image: product.images?.[0] || null,
        price: variant ? variant.price : product.price,
        quantity: Math.min(max, quantity),
        maxQty: max,
      }];
    });
    if (!silent) {
      setOpen(true);
      toast.success("Added to cart");
    }
  }, []);

  const remove = useCallback((key) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const setQty = useCallback((key, qty) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(i.maxQty || 20, qty)) } : i))), []);
  const clear = useCallback(() => setItems([]), []);

  /** Update prices/stock in the cart from fresh product data. Returns a list of changes. */
  const sync = useCallback((products) => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const notes = [];
    setItems((prev) => prev.flatMap((i) => {
      const p = byId.get(i.productId);
      const v = p && i.variantId ? p.variants.find((x) => x.id === i.variantId) : null;
      if (!p || (i.variantId && !v)) { notes.push(`${i.name} is no longer available and was removed`); return []; }
      const stock = v ? v.stock : p.stock;
      const price = v ? v.price : p.price;
      if (stock <= 0) { notes.push(`${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} is out of stock and was removed`); return []; }
      const next = { ...i, price, maxQty: Math.min(20, stock), image: p.images?.[0] || i.image, name: p.name, slug: p.slug };
      if (price !== i.price) notes.push(`The price of ${p.name} changed to KSh ${price.toLocaleString("en-KE")}`);
      if (i.quantity > stock) { next.quantity = stock; notes.push(`Only ${stock} of ${p.name} left — quantity updated`); }
      return [next];
    }));
    return notes;
  }, []);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  const value = useMemo(() => ({ items, open, setOpen, add, remove, setQty, clear, sync, subtotal, count }),
    [items, open, add, remove, setQty, clear, sync, subtotal, count]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/* ---------------- Wishlist ---------------- */
const WishlistContext = createContext(null);
export const useWishlist = () => useContext(WishlistContext);

function WishlistProvider({ children }) {
  const [items, setItems] = useState(() => read("vitron_wishlist", []));
  useEffect(() => write("vitron_wishlist", items), [items]);

  const toggle = useCallback((p) => {
    const exists = items.some((x) => x.id === p.id);
    setItems((prev) => prev.some((x) => x.id === p.id)
      ? prev.filter((x) => x.id !== p.id)
      : [...prev, { id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.images?.[0] || null }]);
    if (!exists) toast.success("Saved to wishlist");
  }, [items]);
  const has = useCallback((id) => items.some((x) => x.id === id), [items]);

  const value = useMemo(() => ({ items, toggle, has, count: items.length }), [items, toggle, has]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>{children}</CartProvider>
      </WishlistProvider>
    </AuthProvider>
  );
}
