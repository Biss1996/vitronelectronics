import { ORDER_STATUS } from "../lib/format.js";

export function StatusBadge({ status }) {
  const s = ORDER_STATUS[status] || { label: status, className: "bg-muted" };
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function PaymentBadge({ status }) {
  return status === "paid"
    ? <span className="badge bg-green-100 text-green-800">Paid</span>
    : <span className="badge bg-zinc-100 text-zinc-700">Unpaid</span>;
}
