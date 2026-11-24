export const formatKES = (n) => `KSh ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;

export const CONDITIONS = {
  new: { label: "Brand new", short: "New", className: "bg-primary-soft text-primary" },
  refurbished: { label: "Refurbished", short: "Refurbished", className: "bg-amber-100 text-amber-800" },
  ex_uk: { label: "Ex-UK", short: "Ex-UK", className: "bg-sky-100 text-sky-800" },
};

export const ORDER_STATUS = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800", help: "We've received your order and will call you to confirm." },
  confirmed: { label: "Confirmed", className: "bg-sky-100 text-sky-800", help: "Your order is confirmed and being prepared." },
  dispatched: { label: "On the way", className: "bg-violet-100 text-violet-800", help: "Your order is out for delivery." },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-800", help: "Delivered. Thank you for shopping with us!" },
  cancelled: { label: "Cancelled", className: "bg-zinc-200 text-zinc-700", help: "This order was cancelled." },
};

export const STATUS_FLOW = ["pending", "confirmed", "dispatched", "delivered"];

export function formatDate(d, withTime = true) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleString("en-KE", {
    day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export const displayPhone = (p) => (p || "").replace(/^\+254/, "0");

export const warrantyLabel = (m) =>
  !m ? null : m % 12 === 0 ? `${m / 12} year${m > 12 ? "s" : ""} warranty` : `${m} months warranty`;
