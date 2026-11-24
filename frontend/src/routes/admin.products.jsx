import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FiEdit2, FiEye, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { PageHeader, RequirePermission } from "../components/admin/AdminUI.jsx";
import ProductForm from "../components/admin/ProductForm.jsx";
import ProductImage from "../components/ProductImage.jsx";
import { ErrorBox, PageLoader, Pagination } from "../components/States.jsx";
import { useAuth } from "../context/AppProviders.jsx";
import { api, qs } from "../lib/api.js";
import { CONDITIONS, formatKES } from "../lib/format.js";
import { confirm, toast } from "../lib/toast.js";

export const Route = createFileRoute("/admin/products")({
  validateSearch: (s) => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    category: typeof s.category === "string" && s.category ? s.category : undefined,
    status: ["active", "draft", "low"].includes(s.status) ? s.status : undefined,
    page: Number(s.page) > 1 ? Number(s.page) : undefined,
  }),
  component: () => <RequirePermission permission="products:view"><Products /></RequirePermission>,
});

function Products() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/products" });
  const { can } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState(search.q || "");
  const [editing, setEditing] = useState(null); // null | "new" | product
  useEffect(() => setQ(search.q || ""), [search.q]);

  const canWrite = can("products:write");
  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api("/api/admin/categories").then((d) => d.categories) });
  const list = useQuery({
    queryKey: ["admin", "products", search],
    queryFn: () => api(`/api/admin/products${qs({ ...search, sort: "newest", limit: 25 })}`),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product"] });
    qc.invalidateQueries({ queryKey: ["brands"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const openEdit = async (p) => {
    try {
      const d = await api(`/api/admin/products/${p.id}`); // always edit the freshest copy
      setEditing(d.product);
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (p) => {
    const ok = await confirm({ title: `Delete “${p.name}”?`, text: "If it has orders, it will be hidden instead so order history stays intact.", confirmText: "Delete", danger: true });
    if (!ok) return;
    try {
      const d = await api(`/api/admin/products/${p.id}`, { method: "DELETE" });
      toast.success(d.archived ? "Product hidden (it has orders)" : "Product deleted");
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const setSearch = (patch) => navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) });

  return (
    <>
      <PageHeader title="Products" subtitle={canWrite ? "Add, edit and price your products." : "View only — ask an admin to edit products."}
        actions={canWrite && <button onClick={() => setEditing("new")} className="btn-primary"><FiPlus /> Add product</button>} />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
          <form onSubmit={(e) => { e.preventDefault(); setSearch({ q: q.trim() || undefined }); }} className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand or SKU" className="input pl-9" />
          </form>
          <select value={search.category || ""} onChange={(e) => setSearch({ category: e.target.value || undefined })} className="input sm:w-48">
            <option value="">All categories</option>
            {categories.data?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={search.status || ""} onChange={(e) => setSearch({ status: e.target.value || undefined })} className="input sm:w-40">
            <option value="">Any status</option>
            <option value="active">Visible</option>
            <option value="draft">Hidden</option>
            <option value="low">Low stock (≤3)</option>
          </select>
        </div>

        {list.isPending ? <PageLoader /> : list.isError ? <div className="p-6"><ErrorBox error={list.error} onRetry={list.refetch} /></div> : list.data.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No products found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr>
              </thead>
              <tbody className="divide-y">
                {list.data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductImage src={p.images[0]} className="h-11 w-11 shrink-0 rounded border p-0.5" iconSize={14} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.brand}{p.condition !== "new" ? ` · ${CONDITIONS[p.condition]?.short}` : ""}{p.variants.length ? ` · ${p.variants.length} options` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{p.category?.name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">{p.variants.length ? "from " : ""}{formatKES(p.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.stock === 0 ? "font-semibold text-primary" : p.stock <= 3 ? "font-semibold text-warning" : ""}>{p.stock}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.active ? <span className="badge bg-green-100 text-green-800">Visible</span> : <span className="badge bg-zinc-200 text-zinc-700">Hidden</span>}
                      {p.featured && <span className="badge ml-1 bg-primary-soft text-primary">Featured</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {p.active && <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" title="View in store"><FiEye /></a>}
                        {canWrite && <button onClick={() => openEdit(p)} className="btn-ghost btn-sm" title="Edit"><FiEdit2 /></button>}
                        {canWrite && <button onClick={() => remove(p)} className="btn-ghost btn-sm text-primary" title="Delete"><FiTrash2 /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {list.data && <Pagination page={search.page || 1} pages={list.data.pages} onChange={(p) => navigate({ search: (prev) => ({ ...prev, page: p }) })} />}

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          categories={categories.data || []}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </>
  );
}
