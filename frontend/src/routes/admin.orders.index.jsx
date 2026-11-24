import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { PageHeader, RequirePermission } from "../components/admin/AdminUI.jsx";
import { ErrorBox, PageLoader, Pagination } from "../components/States.jsx";
import { PaymentBadge, StatusBadge } from "../components/StatusBadge.jsx";
import { api, qs } from "../lib/api.js";
import { ORDER_STATUS, displayPhone, formatDate, formatKES } from "../lib/format.js";

export const Route = createFileRoute("/admin/orders/")({
  validateSearch: (s) => ({
    status: typeof s.status === "string" && ORDER_STATUS[s.status] ? s.status : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    page: Number(s.page) > 1 ? Number(s.page) : undefined,
  }),
  component: () => <RequirePermission permission="orders:view"><Orders /></RequirePermission>,
});

function Orders() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/orders/" });
  const [q, setQ] = useState(search.q || "");
  useEffect(() => setQ(search.q || ""), [search.q]);

  const query = useQuery({
    queryKey: ["admin", "orders", search],
    queryFn: () => api(`/api/admin/orders${qs({ ...search, limit: 25 })}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const counts = query.data?.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  const tabs = [["", "All", all], ...Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label, counts[k] || 0])];

  return (
    <>
      <PageHeader title="Orders" subtitle="Confirm by phone, dispatch, then mark as paid on delivery." />
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(([k, label, n]) => (
              <button key={k} onClick={() => navigate({ search: { status: k || undefined, q: search.q } })}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${(search.status || "") === k ? "bg-primary text-white" : "hover:bg-muted"}`}>
                {label} <span className="ml-1 text-xs opacity-70">{n}</span>
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); navigate({ search: { status: search.status, q: q.trim() || undefined } }); }} className="relative lg:w-72">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order no., name or phone" className="input pl-9" />
          </form>
        </div>

        {query.isPending ? <PageLoader /> : query.isError ? <div className="p-6"><ErrorBox error={query.error} onRetry={query.refetch} /></div> : query.data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {query.data.items.map((o) => (
                  <tr key={o.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/admin/orders/$id", params: { id: String(o.id) } })}>
                    <td className="px-4 py-3">
                      <Link to="/admin/orders/$id" params={{ id: String(o.id) }} className="font-semibold hover:text-primary" onClick={(e) => e.stopPropagation()}>{o.orderNumber}</Link>
                      <p className="text-xs text-muted-foreground">{o.itemCount} item{o.itemCount === 1 ? "" : "s"}</p>
                    </td>
                    <td className="px-4 py-3">{o.customer.fullName}<p className="text-xs text-muted-foreground">{displayPhone(o.customer.phone)}</p></td>
                    <td className="px-4 py-3">{o.delivery.town}<p className="text-xs text-muted-foreground">{o.delivery.zone}</p></td>
                    <td className="px-4 py-3 text-right font-semibold">{formatKES(o.total)}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><StatusBadge status={o.status} /><PaymentBadge status={o.paymentStatus} /></div></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {query.data && <Pagination page={search.page || 1} pages={query.data.pages} onChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }) })} />}
    </>
  );
}
