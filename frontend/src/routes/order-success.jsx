import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";
import OrderView from "../components/OrderView.jsx";
import { useAuth } from "../context/AppProviders.jsx";
import { useSettings } from "../lib/queries.js";
import { orderMessage, waLink } from "../lib/whatsapp.js";
import { displayPhone } from "../lib/format.js";

export const Route = createFileRoute("/order-success")({
  validateSearch: (s) => ({ number: typeof s.number === "string" ? s.number : undefined }),
  component: OrderSuccess,
});

function OrderSuccess() {
  const { number } = Route.useSearch();
  const { data: settings } = useSettings();
  const { user } = useAuth();

  const order = useMemo(() => {
    try {
      const o = JSON.parse(sessionStorage.getItem("vitron_last_order") || "null");
      return o && o.orderNumber === number ? o : null;
    } catch { return null; }
  }, [number]);

  const link = order && settings?.whatsappNumber ? waLink(settings.whatsappNumber, orderMessage(order, settings.storeName)) : null;

  // Try to open WhatsApp automatically once. Browsers may block this, so the button stays.
  useEffect(() => {
    if (!link) return;
    const key = `vitron_wa_opened_${order.orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* ignore */ }
    window.open(link, "_blank", "noopener");
  }, [link, order?.orderNumber]);

  return (
    <div className="container-x max-w-3xl py-10">
      <div className="text-center">
        <FiCheckCircle className="mx-auto text-success" size={56} />
        <h1 className="mt-4 text-3xl font-bold">Thank you! Your order is placed.</h1>
        <p className="mt-2 text-muted-foreground">
          {order ? <>We'll call <b className="text-ink">{displayPhone(order.customer.phone)}</b> shortly to confirm delivery.</> : "We'll call you shortly to confirm delivery."}
        </p>
      </div>

      {link && (
        <div className="card mt-8 border-[#25D366] bg-[#25D366]/5 p-5 text-center">
          <p className="font-semibold">Send your order to us on WhatsApp</p>
          <p className="mt-1 text-sm text-muted-foreground">This helps us confirm and dispatch your order faster.</p>
          <a href={link} target="_blank" rel="noreferrer" className="btn-whatsapp mt-4 px-8 py-3 text-base">
            <FaWhatsapp size={20} /> Send order on WhatsApp
          </a>
        </div>
      )}

      {order ? (
        <div className="card mt-6 p-5 sm:p-6"><OrderView order={order} showHistory={false} /></div>
      ) : (
        <div className="card mt-6 p-6 text-center">
          <p className="text-sm text-muted-foreground">Your order number</p>
          <p className="font-display text-2xl font-bold">{number}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/track" search={{ number, phone: order ? displayPhone(order.customer.phone) : undefined }} className="btn-secondary">Track this order</Link>
        <Link to="/shop" className="btn-outline">Continue shopping</Link>
        {user && <Link to="/account" className="btn-ghost">My orders</Link>}
      </div>
    </div>
  );
}
