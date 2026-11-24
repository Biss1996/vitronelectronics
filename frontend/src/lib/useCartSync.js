import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { useCart } from "../context/AppProviders.jsx";

/** Refresh cart prices and stock from the server once when the page opens. */
export function useCartSync() {
  const cart = useCart();
  const [notes, setNotes] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || cart.items.length === 0) return;
    done.current = true;
    const ids = [...new Set(cart.items.map((i) => i.productId))].join(",");
    setSyncing(true);
    api(`/api/products?ids=${ids}&limit=100`)
      .then((d) => setNotes(cart.sync(d.items)))
      .catch(() => { /* keep cart as-is; the server re-checks everything at checkout */ })
      .finally(() => setSyncing(false));
  }, [cart]);

  return { notes, syncing };
}
