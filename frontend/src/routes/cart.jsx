import { Link, createFileRoute } from "@tanstack/react-router";
import { FiShoppingCart, FiTrash2, FiInfo } from "react-icons/fi";
import ProductImage from "../components/ProductImage.jsx";
import QtyStepper from "../components/QtyStepper.jsx";
import { EmptyState } from "../components/States.jsx";
import { useCart } from "../context/AppProviders.jsx";
import { formatKES } from "../lib/format.js";
import { useSettings } from "../lib/queries.js";
import { useCartSync } from "../lib/useCartSync.js";

export const Route = createFileRoute("/cart")({ component: CartPage });

function CartPage() {
  const cart = useCart();
  const { data: settings } = useSettings();
  const { notes } = useCartSync();

  if (cart.items.length === 0) {
    return (
      <div className="container-x">
        <EmptyState icon={FiShoppingCart} title="Your cart is empty" text="Browse our latest phones, laptops and more."
          action={<Link to="/shop" className="btn-primary">Start shopping</Link>} />
      </div>
    );
  }

  const free = settings?.deliveryFeesEnabled ? settings?.freeDeliveryOver || 0 : 0;
  const toFree = free > 0 ? free - cart.subtotal : 0;

  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-bold">Shopping cart</h1>
      {notes.length > 0 && (
        <div className="mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {notes.map((n) => <p key={n} className="flex items-center gap-2"><FiInfo /> {n}</p>)}
        </div>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="card divide-y">
          {cart.items.map((i) => (
            <div key={i.key} className="flex gap-4 p-4">
              <Link to="/product/$slug" params={{ slug: i.slug }}><ProductImage src={i.image} alt={i.name} className="h-24 w-24 rounded-lg border p-1" iconSize={20} /></Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-3">
                  <div>
                    <Link to="/product/$slug" params={{ slug: i.slug }} className="font-medium hover:text-primary">{i.name}</Link>
                    {i.variantLabel && <p className="text-sm text-muted-foreground">{i.variantLabel}</p>}
                    <p className="mt-1 text-sm text-muted-foreground">{formatKES(i.price)} each</p>
                  </div>
                  <button onClick={() => cart.remove(i.key)} className="h-fit text-muted-foreground hover:text-primary" aria-label="Remove"><FiTrash2 /></button>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <QtyStepper size="sm" value={i.quantity} max={i.maxQty} onChange={(q) => cart.setQty(i.key, q)} />
                  <span className="font-semibold">{formatKES(i.price * i.quantity)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal ({cart.count} items)</span><span className="font-semibold">{formatKES(cart.subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Delivery</span>{settings?.deliveryFeesEnabled ? <span>Calculated at checkout</span> : <span className="font-semibold text-success">FREE</span>}</div>
          </div>
          {toFree > 0 && (
            <p className="mt-4 rounded-lg bg-primary-soft p-3 text-xs text-primary">Add {formatKES(toFree)} more for <b>free delivery</b>.</p>
          )}
          <Link to="/checkout" className="btn-primary mt-5 w-full py-3">Proceed to checkout</Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">No payment now — pay when your order arrives.</p>
        </aside>
      </div>
    </div>
  );
}
