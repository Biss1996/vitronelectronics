import { Link, useNavigate } from "@tanstack/react-router";
import { FiShoppingCart, FiTrash2, FiX } from "react-icons/fi";
import { useCart } from "../context/AppProviders.jsx";
import { formatKES } from "../lib/format.js";
import ProductImage from "./ProductImage.jsx";
import QtyStepper from "./QtyStepper.jsx";

export default function CartDrawer() {
  const cart = useCart();
  const navigate = useNavigate();
  if (!cart.open) return null;
  const go = (to) => { cart.setOpen(false); navigate({ to }); };

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => cart.setOpen(false)}>
      <aside className="slide-in absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Your cart ({cart.count})</h2>
          <button onClick={() => cart.setOpen(false)} aria-label="Close cart"><FiX size={22} /></button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <FiShoppingCart size={36} className="text-muted-foreground" />
            <p className="mt-3 font-medium">Your cart is empty</p>
            <button onClick={() => go("/shop")} className="btn-primary mt-5">Start shopping</button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {cart.items.map((i) => (
                <div key={i.key} className="flex gap-3">
                  <Link to="/product/$slug" params={{ slug: i.slug }} onClick={() => cart.setOpen(false)} className="shrink-0">
                    <ProductImage src={i.image} alt={i.name} className="h-20 w-20 rounded-lg border p-1" iconSize={18} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{i.name}</p>
                    {i.variantLabel && <p className="text-xs text-muted-foreground">{i.variantLabel}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <QtyStepper size="sm" value={i.quantity} max={i.maxQty} onChange={(q) => cart.setQty(i.key, q)} />
                      <span className="text-sm font-semibold">{formatKES(i.price * i.quantity)}</span>
                    </div>
                  </div>
                  <button onClick={() => cart.remove(i.key)} className="self-start text-muted-foreground hover:text-primary" aria-label="Remove"><FiTrash2 /></button>
                </div>
              ))}
            </div>
            <div className="border-t p-5">
              <div className="flex justify-between text-base font-semibold">
                <span>Subtotal</span><span>{formatKES(cart.subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Free delivery. Pay when your order arrives — cash or M-Pesa.</p>
              <button onClick={() => go("/checkout")} className="btn-primary mt-4 w-full py-3">Checkout</button>
              <button onClick={() => go("/cart")} className="btn-ghost mt-2 w-full">View cart</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
