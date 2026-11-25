import { formatKES, displayPhone } from "./format.js";

export const waLink = (number, text) =>
  `https://wa.me/${String(number || "").replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** The message the customer sends to the store after placing an order. */
export function orderMessage(order, storeName = "Vitron") {
  const lines = [
    `🛒 *New order ${order.orderNumber}* — ${storeName}`,
    "",
    `*Name:* ${order.customer.fullName}`,
    `*Phone:* ${displayPhone(order.customer.phone)}`,
    order.customer.altPhone ? `*Alt phone:* ${displayPhone(order.customer.altPhone)}` : null,
    `*Delivery:* ${order.delivery.zone} — ${order.delivery.town}`,
    `*Address:* ${order.delivery.address}`,
    order.delivery.notes ? `*Notes:* ${order.delivery.notes}` : null,
    "",
    "*Items*",
    ...order.items.map(
      (i, n) => `${n + 1}. ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} × ${i.quantity} — ${formatKES(i.lineTotal)}`,
    ),
    "",
    `Subtotal: ${formatKES(order.subtotal)}`,
    `Delivery: ${order.deliveryFeePending ? "to be confirmed" : order.deliveryFee === 0 ? "FREE" : formatKES(order.deliveryFee)}`,
    `*Total: ${formatKES(order.total)}*${order.deliveryFeePending ? " + delivery" : ""} (pay on delivery)`,
    "",
    `Track: ${window.location.origin}/track?number=${order.orderNumber}`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

export function productEnquiry(product, variantLabel) {
  return `Hi! I'm interested in *${product.name}*${variantLabel ? ` (${variantLabel})` : ""}.\n${window.location.origin}/product/${product.slug}`;
}
