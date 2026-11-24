import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FiArrowLeft, FiPhone, FiPrinter } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";
import { RequirePermission } from "../components/admin/AdminUI.jsx";
import OrderView from "../components/OrderView.jsx";
import { ErrorBox, PageLoader, Spinner } from "../components/States.jsx";
import { PaymentBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AppProviders.jsx";
import { api } from "../lib/api.js";
import { ORDER_STATUS, displayPhone, formatKES } from "../lib/format.js";
import { useSettings } from "../lib/queries.js";
import { confirm, toast } from "../lib/toast.js";
import { waLink } from "../lib/whatsapp.js";

export const Route = createFileRoute("/admin/orders/$id")({
  component: () => <RequirePermission permission="orders:view"><OrderDetail /></RequirePermission>,
});

// Next steps offered for each status (must match the backend's allowed transitions).
const NEXT = {
  pending: [["confirmed", "Confirm order"], ["cancelled", "Cancel"]],
  confirmed: [["dispatched", "Mark dispatched"], ["cancelled", "Cancel"]],
  dispatched: [["delivered", "Mark delivered"], ["cancelled", "Cancel"]],
  delivered: [],
  cancelled: [],
};

function OrderDetail() {
  const { id } = Route.useParams();
  const { can } = useAuth();
  const { data: settings } = useSettings();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const q = useQuery({ queryKey: ["admin", "order", id], queryFn: () => api(`/api/admin/orders/${id}`).then((d) => d.order) });

  const update = useMutation({
    mutationFn: (body) => api(`/api/admin/orders/${id}`, { method: "PATCH", body }).then((d) => d.order),
    onSuccess: (order) => {
      qc.setQueryData(["admin", "order", id], order);
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      qc.invalidateQueries({ queryKey: ["admin", "pending-count"] });
      setNote("");
      toast.success("Order updated");
    },
    onError: (e) => toast.error(e.message),
  });

  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={q.refetch} />;
  const o = q.data;
  const canUpdate = can("orders:update");

  const changeStatus = async (status, label) => {
    if (status === "cancelled") {
      const ok = await confirm({ title: `Cancel ${o.orderNumber}?`, text: "Items go back into stock. This can't be undone.", confirmText: "Cancel order", danger: true });
      if (!ok) return;
    }
    update.mutate({ status, note: note.trim() || undefined });
  };

  const customerMsg = `Hi ${o.customer.fullName.split(" ")[0]}, this is ${settings?.storeName || "Vitron"} about your order ${o.orderNumber} (${formatKES(o.total)}). `;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/orders" className="btn-ghost -ml-3"><FiArrowLeft /> All orders</Link>
        <div className="flex flex-wrap gap-2">
          <a href={`tel:${o.customer.phone}`} className="btn-outline"><FiPhone /> Call</a>
          <a href={waLink(o.customer.phone, customerMsg)} target="_blank" rel="noreferrer" className="btn-whatsapp"><FaWhatsapp /> WhatsApp customer</a>
          <button onClick={() => window.print()} className="btn-outline"><FiPrinter /> Print</button>
        </div>
      </div>

      {canUpdate && (NEXT[o.status].length > 0 || o.status !== "cancelled") && (
        <div className="no-print card mb-5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm font-semibold">Update:</span>
            {NEXT[o.status].map(([s, label]) => (
              <button key={s} disabled={update.isPending} onClick={() => changeStatus(s, label)}
                className={s === "cancelled" ? "btn-outline btn-sm text-primary" : "btn-primary btn-sm"}>{label}</button>
            ))}
            {o.status !== "cancelled" && (
              <button disabled={update.isPending} onClick={() => update.mutate({ paymentStatus: o.paymentStatus === "paid" ? "unpaid" : "paid" })}
                className={o.paymentStatus === "paid" ? "btn-outline btn-sm" : "btn-secondary btn-sm"}>
                {o.paymentStatus === "paid" ? "Mark as unpaid" : `Mark paid (${formatKES(o.total)})`}
              </button>
            )}
            <span className="ml-auto flex items-center gap-2 text-sm">Payment: <PaymentBadge status={o.paymentStatus} /></span>
            {update.isPending && <Spinner className="h-4 w-4 text-primary" />}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (e.g. rider name, call outcome) — saved with the next update" className="input" maxLength={500} />
            <button disabled={!note.trim() || update.isPending} onClick={() => update.mutate({ note: note.trim() })} className="btn-outline">Save note</button>
          </div>
          {NEXT[o.status].length > 0 && <p className="mt-2 text-xs text-muted-foreground">{ORDER_STATUS[o.status].label} → next: {NEXT[o.status].map(([s]) => ORDER_STATUS[s].label).join(" or ")}</p>}
        </div>
      )}

      <div className="print-area card p-5 sm:p-6">
        <div className="mb-4 hidden print:block">
          <p className="font-display text-2xl font-bold">{settings?.storeName || "Vitron"} — Delivery note</p>
          <p className="text-sm">Customer: {o.customer.fullName}, {displayPhone(o.customer.phone)} · Collect: {o.paymentStatus === "paid" ? "PAID" : formatKES(o.total)}</p>
        </div>
        <OrderView order={o} />
      </div>
    </div>
  );
}
