import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, RequirePermission, StatCard } from "../components/admin/AdminUI.jsx";
import ProductImage from "../components/ProductImage.jsx";
import { ErrorBox, PageLoader } from "../components/States.jsx";
import { PaymentBadge, StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AppProviders.jsx";
import { api } from "../lib/api.js";
import { formatDate, formatKES } from "../lib/format.js";

export const Route = createFileRoute("/admin/")({
  component: () => <RequirePermission permission="dashboard:view"><Dashboard /></RequirePermission>,
});

function Dashboard() {
  const { user, can } = useAuth();
  const q = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api("/api/admin/stats"), refetchInterval: 60_000 });

  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={q.refetch} />;
  const { totals, daily, lowStock, recentOrders, topProducts } = q.data;
  const maxSales = Math.max(1, ...daily.map((d) => d.sales));

  return (
    <>
      <PageHeader title={`Welcome, ${user.fullName.split(" ")[0]}`} subtitle="Here's what's happening in your store." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard tone="solid" label="Orders today" value={totals.ordersToday} hint={formatKES(totals.salesToday)} />
        <StatCard tone="red" label="Waiting to confirm" value={totals.pending} hint="Pending orders" />
        <StatCard label="Sales (30 days)" value={formatKES(totals.sales30d)} hint={`${formatKES(totals.collected30d)} collected`} />
        <StatCard label="To deliver" value={totals.confirmed + totals.dispatched} hint={`${totals.dispatched} on the way · ${totals.deliveredUnpaid} delivered unpaid`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-5">
          <h2 className="font-semibold">Sales — last 14 days</h2>
          <div className="mt-5 flex h-44 items-end gap-1.5">
            {daily.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="rounded-t bg-primary/85 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(2, (d.sales / maxSales) * 100)}%` }} />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-primary-dark px-2 py-1 text-[11px] text-white group-hover:block">
                  {new Date(d.day).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}: {formatKES(d.sales)} · {d.orders} orders
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{new Date(daily[0].day).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</span>
            <span>Today</span>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold">Top sellers (30 days)</h2>
          {topProducts.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No sales yet.</p> : (
            <ul className="mt-4 space-y-3 text-sm">
              {topProducts.map((t, i) => (
                <li key={t.name} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                  <span className="flex-1 truncate">{t.name}</span>
                  <span className="text-muted-foreground">{t.qty} sold</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm font-semibold text-primary">View all</Link>
          </div>
          {recentOrders.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No orders yet.</p> : (
            <div className="divide-y">
              {recentOrders.map((o) => (
                <Link key={o.id} to="/admin/orders/$id" params={{ id: String(o.id) }} className="flex items-center gap-3 p-4 text-sm hover:bg-muted/50">
                  <div className="flex-1">
                    <p className="font-semibold">{o.orderNumber} <span className="font-normal text-muted-foreground">· {o.customer}</span></p>
                    <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)} · {o.itemCount} items</p>
                  </div>
                  <div className="hidden gap-1 sm:flex"><StatusBadge status={o.status} /><PaymentBadge status={o.paymentStatus} /></div>
                  <span className="font-semibold">{formatKES(o.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Low stock</h2>
            {can("stock:update") && <Link to="/admin/inventory" search={{ status: "low" }} className="text-sm font-semibold text-primary">Restock</Link>}
          </div>
          {lowStock.length === 0 ? <p className="p-4 text-sm text-muted-foreground">All products are well stocked.</p> : (
            <ul className="divide-y">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3 text-sm">
                  <ProductImage src={p.image} className="h-10 w-10 rounded border p-0.5" iconSize={12} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className={`badge ${p.stock === 0 ? "bg-primary text-white" : "bg-amber-100 text-amber-800"}`}>{p.stock === 0 ? "Out" : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
