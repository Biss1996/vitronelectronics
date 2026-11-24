import { FiCheck, FiX } from "react-icons/fi";
import { ORDER_STATUS, STATUS_FLOW, displayPhone, formatDate, formatKES } from "../lib/format.js";
import ProductImage from "./ProductImage.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

export function StatusTimeline({ status }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">
        <FiX /> This order was cancelled.
      </div>
    );
  }
  const current = STATUS_FLOW.indexOf(status);
  return (
    <ol className="grid grid-cols-4 gap-1">
      {STATUS_FLOW.map((s, i) => (
        <li key={s} className="flex flex-col items-center text-center">
          <div className="flex w-full items-center">
            <div className={`h-0.5 flex-1 ${i === 0 ? "invisible" : i <= current ? "bg-primary" : "bg-border"}`} />
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${i <= current ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
              {i < current ? <FiCheck /> : i + 1}
            </div>
            <div className={`h-0.5 flex-1 ${i === STATUS_FLOW.length - 1 ? "invisible" : i < current ? "bg-primary" : "bg-border"}`} />
          </div>
          <span className={`mt-1.5 text-[11px] font-medium sm:text-xs ${i <= current ? "text-ink" : "text-muted-foreground"}`}>{ORDER_STATUS[s].label}</span>
        </li>
      ))}
    </ol>
  );
}

export default function OrderView({ order, showHistory = true }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Order number</p>
          <p className="font-display text-xl font-bold">{order.orderNumber}</p>
        </div>
        <div className="text-right">
          <StatusBadge status={order.status} />
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      <StatusTimeline status={order.status} />
      <p className="text-sm text-muted-foreground">{ORDER_STATUS[order.status]?.help}</p>

      <div className="divide-y rounded-lg border">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 p-3">
            <ProductImage src={i.image} alt="" className="h-14 w-14 rounded-md border p-1" iconSize={14} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{i.name}</p>
              <p className="text-xs text-muted-foreground">{i.variantLabel ? `${i.variantLabel} · ` : ""}{i.quantity} × {formatKES(i.unitPrice)}</p>
            </div>
            <span className="text-sm font-semibold">{formatKES(i.lineTotal)}</span>
          </div>
        ))}
        <div className="space-y-1.5 p-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatKES(order.subtotal)}</span></div>
          <div className="flex justify-between"><span>Delivery</span><span>{order.deliveryFee === 0 ? "FREE" : formatKES(order.deliveryFee)}</span></div>
          <div className="flex justify-between pt-1 text-base font-bold"><span>Total (pay on delivery)</span><span>{formatKES(order.total)}</span></div>
        </div>
      </div>

      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-muted p-4">
          <p className="font-semibold">Contact</p>
          <p className="mt-1">{order.customer.fullName}</p>
          <p>{displayPhone(order.customer.phone)}{order.customer.altPhone ? ` / ${displayPhone(order.customer.altPhone)}` : ""}</p>
          {order.customer.email && <p>{order.customer.email}</p>}
        </div>
        <div className="rounded-lg bg-muted p-4">
          <p className="font-semibold">Delivery</p>
          <p className="mt-1">{order.delivery.zone}</p>
          <p>{order.delivery.town} — {order.delivery.address}</p>
          {order.delivery.notes && <p className="mt-1 text-muted-foreground">“{order.delivery.notes}”</p>}
        </div>
      </div>

      {showHistory && order.history?.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">Updates</p>
          <ul className="space-y-2 text-sm">
            {[...order.history].reverse().map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <span className="font-medium">{ORDER_STATUS[h.status]?.label || h.status}</span>
                  {h.note && <span className="text-muted-foreground"> — {h.note}</span>}
                  <p className="text-xs text-muted-foreground">{formatDate(h.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
