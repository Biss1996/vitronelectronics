import { Link, createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FiPhone, FiSearch } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";
import { PageHeader, RequirePermission } from "../components/admin/AdminUI.jsx";
import { ErrorBox, PageLoader, Pagination } from "../components/States.jsx";
import { api, qs } from "../lib/api.js";
import { displayPhone, formatDate, formatKES } from "../lib/format.js";
import { waLink } from "../lib/whatsapp.js";

export const Route = createFileRoute("/admin/customers")({
  component: () => <RequirePermission permission="customers:view"><Customers /></RequirePermission>,
});

function Customers() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState({ q: "", page: 1 });
  const list = useQuery({
    queryKey: ["admin", "customers", search],
    queryFn: () => api(`/api/admin/customers${qs(search)}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone who has ordered or signed up — guests included." />
      <div className="card overflow-hidden">
        <form onSubmit={(e) => { e.preventDefault(); setSearch({ q: input.trim(), page: 1 }); }} className="relative border-b p-3">
          <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search name or phone" className="input pl-9" />
        </form>
        {list.isPending ? <PageLoader /> : list.isError ? <div className="p-6"><ErrorBox error={list.error} onRetry={list.refetch} /></div> : list.data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No customers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Account</th><th className="px-4 py-3 text-right">Orders</th><th className="px-4 py-3 text-right">Spent</th><th className="px-4 py-3">Last order</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y">
                {list.data.items.map((c) => (
                  <tr key={c.phone} className="hover:bg-muted/40">
                    <td className="px-4 py-3"><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{displayPhone(c.phone)}{c.email ? ` · ${c.email}` : ""}</p></td>
                    <td className="px-4 py-3">{c.hasAccount ? <span className="badge bg-primary-soft text-primary">Registered</span> : <span className="badge bg-muted">Guest</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {c.orders > 0 ? <Link to="/admin/orders" search={{ q: displayPhone(c.phone) }} className="font-semibold text-primary hover:underline">{c.orders}</Link> : 0}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatKES(c.spent)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.lastOrderAt ? formatDate(c.lastOrderAt, false) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <a href={`tel:${c.phone}`} className="btn-ghost btn-sm" title="Call"><FiPhone /></a>
                        <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm text-[#25D366]" title="WhatsApp"><FaWhatsapp /></a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {list.data && <Pagination page={search.page} pages={list.data.pages} onChange={(p) => setSearch((s) => ({ ...s, page: p }))} />}
    </>
  );
}
