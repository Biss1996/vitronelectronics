import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FiInfo, FiLock, FiShoppingCart, FiTruck } from "react-icons/fi";
import Field from "../components/Field.jsx";
import ProductImage from "../components/ProductImage.jsx";
import { EmptyState, Spinner } from "../components/States.jsx";
import { useAuth, useCart } from "../context/AppProviders.jsx";
import { api } from "../lib/api.js";
import { displayPhone, formatKES } from "../lib/format.js";
import { useSettings } from "../lib/queries.js";
import { useCartSync } from "../lib/useCartSync.js";
import { alertError } from "../lib/toast.js";

export const Route = createFileRoute("/checkout")({ component: Checkout });

function Checkout() {
  const cart = useCart();
  const { user, saveSession } = useAuth();
  const { data: settings } = useSettings();
  const { notes } = useCartSync();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    phone: user?.phone ? displayPhone(user.phone) : "",
    altPhone: "",
    email: user?.email || "",
    zoneId: "",
    town: "",
    address: "",
    notes: "",
    createAccount: false,
    password: "",
  });

  // Fill in details once the signed-in user loads.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      fullName: f.fullName || user.fullName,
      phone: f.phone || displayPhone(user.phone),
      email: f.email || user.email || "",
    }));
  }, [user]);

  // Default delivery zone.
  useEffect(() => {
    if (settings?.deliveryZones?.length && !form.zoneId) setForm((f) => ({ ...f, zoneId: settings.deliveryZones[0].id }));
  }, [settings, form.zoneId]);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  if (cart.items.length === 0 && !submitting) {
    return (
      <div className="container-x">
        <EmptyState icon={FiShoppingCart} title="Your cart is empty" action={<Link to="/shop" className="btn-primary">Continue shopping</Link>} />
      </div>
    );
  }

  const zone = settings?.deliveryZones?.find((z) => z.id === form.zoneId);
  const freeOver = settings?.freeDeliveryOver || 0;
  const deliveryFee = zone ? (freeOver > 0 && cart.subtotal >= freeOver ? 0 : zone.fee) : null;
  const total = cart.subtotal + (deliveryFee || 0);

  const validate = () => {
    const e = {};
    if (form.fullName.trim().length < 2) e.fullName = "Enter your full name";
    if (!/^(\+?254|0)?[17]\d{8}$/.test(form.phone.replace(/[\s-]/g, ""))) e.phone = "Enter a valid phone number, e.g. 0712345678";
    if (form.altPhone && !/^(\+?254|0)?[17]\d{8}$/.test(form.altPhone.replace(/[\s-]/g, ""))) e.altPhone = "Enter a valid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email looks invalid";
    if (!form.zoneId) e.zoneId = "Choose a delivery area";
    if (form.town.trim().length < 2) e.town = "Enter your town or area";
    if (form.address.trim().length < 3) e.address = "Enter your delivery address or landmark";
    if (form.createAccount && form.password.length < 6) e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const placeOrder = async (e) => {
    e.preventDefault();
    if (!validate()) {
      document.querySelector("[aria-invalid=true]")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const d = await api("/api/orders", {
        method: "POST",
        body: {
          ...form,
          createAccount: !user && form.createAccount,
          items: cart.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
        },
      });
      if (d.token) saveSession(d.user, d.token);
      try { sessionStorage.setItem("vitron_last_order", JSON.stringify(d.order)); } catch { /* ignore */ }
      cart.clear();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      navigate({ to: "/order-success", search: { number: d.order.orderNumber } });
    } catch (err) {
      if (err.details && !Array.isArray(err.details.items)) setErrors(err.details);
      alertError("Couldn't place your order", err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><FiLock /> No payment now. You pay cash or M-Pesa when your order is delivered.</p>

      {notes.length > 0 && (
        <div className="mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {notes.map((n) => <p key={n} className="flex items-center gap-2"><FiInfo /> {n}</p>)}
        </div>
      )}

      <form onSubmit={placeOrder} noValidate className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="text-lg font-semibold">1. Your details</h2>
            {!user && (
              <p className="mt-1 text-sm text-muted-foreground">
                Have an account? <Link to="/login" search={{ redirect: "/checkout" }} className="font-semibold text-primary">Sign in</Link> — or just continue as a guest.
              </p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full name *" value={form.fullName} onChange={set("fullName")} error={errors.fullName} autoComplete="name" className="sm:col-span-2" />
              <Field label="Phone number *" type="tel" value={form.phone} onChange={set("phone")} error={errors.phone} placeholder="0712 345 678" autoComplete="tel" hint="We'll call this number to confirm your order." />
              <Field label="Alternative phone" type="tel" value={form.altPhone} onChange={set("altPhone")} error={errors.altPhone} placeholder="Optional" />
              <Field label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="Optional" autoComplete="email" className="sm:col-span-2" />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-semibold">2. Delivery</h2>
            <div className="mt-4 grid gap-3">
              {settings?.deliveryZones?.map((z) => {
                const fee = freeOver > 0 && cart.subtotal >= freeOver ? 0 : z.fee;
                return (
                  <label key={z.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3.5 ${form.zoneId === z.id ? "border-primary bg-primary-soft/50" : "border-border"}`}>
                    <input type="radio" name="zone" checked={form.zoneId === z.id} onChange={() => setForm((f) => ({ ...f, zoneId: z.id }))} className="h-4 w-4 accent-primary" />
                    <FiTruck className="text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{z.name}</p>
                      {z.eta && <p className="text-xs text-muted-foreground">{z.eta}</p>}
                    </div>
                    <span className="text-sm font-semibold">{fee === 0 ? <span className="text-success">FREE</span> : formatKES(fee)}</span>
                  </label>
                );
              })}
              {errors.zoneId && <span className="field-error">{errors.zoneId}</span>}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Town / area *" value={form.town} onChange={set("town")} error={errors.town} placeholder="e.g. Westlands, Nairobi" />
              <Field label="Address / landmark *" value={form.address} onChange={set("address")} error={errors.address} placeholder="Building, street, house no." autoComplete="street-address" />
              <Field as="textarea" rows={2} label="Delivery notes" value={form.notes} onChange={set("notes")} error={errors.notes} placeholder="Optional — e.g. best time to call" className="sm:col-span-2" />
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-lg font-semibold">3. Payment</h2>
            <div className="mt-4 flex items-center gap-3 rounded-lg border-2 border-primary bg-primary-soft/50 p-3.5">
              <input type="radio" checked readOnly className="h-4 w-4 accent-primary" />
              <div>
                <p className="text-sm font-semibold">Pay on delivery</p>
                <p className="text-xs text-muted-foreground">Cash or M-Pesa to our rider when you receive your order.</p>
              </div>
            </div>
          </section>

          {!user && (
            <section className="card p-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={form.createAccount} onChange={set("createAccount")} className="mt-0.5 h-4 w-4 accent-primary" />
                <span>
                  <span className="text-sm font-semibold">Create an account so I can track my orders</span>
                  <span className="block text-xs text-muted-foreground">Optional. Uses the name and phone number above.</span>
                </span>
              </label>
              {form.createAccount && (
                <Field label="Choose a password *" type="password" value={form.password} onChange={set("password")} error={errors.password} autoComplete="new-password" className="mt-4 max-w-sm" />
              )}
            </section>
          )}
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Your order</h2>
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto">
            {cart.items.map((i) => (
              <div key={i.key} className="flex gap-3">
                <div className="relative shrink-0">
                  <ProductImage src={i.image} alt="" className="h-14 w-14 rounded-lg border p-1" iconSize={14} />
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">{i.quantity}</span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="line-clamp-2 font-medium">{i.name}</p>
                  {i.variantLabel && <p className="text-xs text-muted-foreground">{i.variantLabel}</p>}
                </div>
                <span className="text-sm font-semibold">{formatKES(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatKES(cart.subtotal)}</span></div>
            <div className="flex justify-between"><span>Delivery</span><span>{deliveryFee === null ? "—" : deliveryFee === 0 ? "FREE" : formatKES(deliveryFee)}</span></div>
            <div className="flex justify-between border-t pt-3 text-base font-bold"><span>Total</span><span>{formatKES(total)}</span></div>
          </div>
          <button disabled={submitting} className="btn-primary mt-5 w-full py-3.5 text-base">
            {submitting ? <><Spinner className="h-4 w-4" /> Placing order…</> : "Place order"}
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">After placing your order you can send the details to us on WhatsApp.</p>
        </aside>
      </form>
    </div>
  );
}
