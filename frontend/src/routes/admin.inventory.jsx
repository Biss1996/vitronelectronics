import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { PageHeader, RequirePermission } from "../components/admin/AdminUI.jsx";
import ProductImage from "../components/ProductImage.jsx";
import { ErrorBox, PageLoader, Pagination, Spinner } from "../components/States.jsx";
import { api, qs } from "../lib/api.js";
import { toast } from "../lib/toast.js";

export const Route = createFileRoute("/admin/inventory")({
  validateSearch: (s) => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    status: s.status === "low" ? "low" : undefined,
    page: Number(s.page) > 1 ? Number(s.page) : undefined,
  }),
  component: () => <RequirePermission permission="stock:update"><Inventory /></RequirePermission>,
});

function Inventory() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/inventory" });
  const [q, setQ] = useState(search.q || "");
  useEffect(() => setQ(search.q || ""), [search.q]);

  const list = useQuery({
    queryKey: ["admin", "products", "inventory", search],
    queryFn: () => api(`/api/admin/products${qs({ ...search, sort: "name", limit: 30 })}`),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Inventory" subtitle="Update stock levels after deliveries arrive or a stock count." />
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
          <form onSubmit={(e) => { e.preventDefault(); navigate({ search: { ...search, q: q.trim() || undefined, page: undefined } }); }} className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="input pl-9" />
          </form>
          <label className="flex items-center gap-2 px-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={search.status === "low"}
              onChange={(e) => navigate({ search: { ...search, status: e.target.checked ? "low" : undefined, page: undefined } })} />
            Low stock only
          </label>
        </div>
        {list.isPending ? <PageLoader /> : list.isError ? <div className="p-6"><ErrorBox error={list.error} onRetry={list.refetch} /></div> : list.data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Nothing to show.</p>
        ) : (
          <div className="divide-y">{list.data.items.map((p) => <StockRow key={p.id} product={p} />)}</div>
        )}
      </div>
      {list.data && <Pagination page={search.page || 1} pages={list.data.pages} onChange={(p) => navigate({ search: { ...search, page: p } })} />}
    </>
  );
}

function StockRow({ product: p }) {
  const qc = useQueryClient();
  const initial = () => (p.variants.length ? Object.fromEntries(p.variants.map((v) => [v.id, String(v.stock)])) : { main: String(p.stock) });
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValues(initial()), [p]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = p.variants.length
    ? p.variants.some((v) => values[v.id] !== String(v.stock))
    : values.main !== String(p.stock);

  const save = async () => {
    setSaving(true);
    try {
      const body = p.variants.length
        ? { variants: p.variants.map((v) => ({ id: v.id, stock: Number(values[v.id]) })) }
        : { stock: Number(values.main) };
      await api(`/api/admin/products/${p.id}/stock`, { method: "PATCH", body });
      toast.success(`Stock updated: ${p.name}`);
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product"] });
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const input = (key, label) => (
    <label key={key} className="flex items-center gap-2 text-sm">
      {label && <span className="min-w-24 text-muted-foreground">{label}</span>}
      <input type="number" min="0" value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        className={`input w-24 text-right ${Number(values[key]) === 0 ? "border-primary/50" : ""}`} />
    </label>
  );

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ProductImage src={p.images[0]} className="h-11 w-11 shrink-0 rounded border p-0.5" iconSize={14} />
        <div className="min-w-0">
          <p className="truncate font-medium">{p.name}</p>
          <p className="text-xs text-muted-foreground">{p.sku || p.brand || ""}{!p.active && " · hidden"}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-2">
          {p.variants.length ? p.variants.map((v) => input(v.id, v.label)) : input("main")}
        </div>
        <button onClick={save} disabled={!dirty || saving} className="btn-primary btn-sm w-20">{saving ? <Spinner className="h-3 w-3" /> : "Save"}</button>
      </div>
    </div>
  );
}
