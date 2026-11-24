import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FiFilter, FiSearch, FiX } from "react-icons/fi";
import ProductCard from "../components/ProductCard.jsx";
import { EmptyState, ErrorBox, Pagination, ProductGridSkeleton } from "../components/States.jsx";
import { useBrands, useCategories, useProducts } from "../lib/queries.js";
import { CONDITIONS } from "../lib/format.js";

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v) => (Number(v) > 0 ? Number(v) : undefined);

export const Route = createFileRoute("/shop")({
  validateSearch: (s) => ({
    q: str(s.q),
    category: str(s.category),
    brand: str(s.brand),
    condition: str(s.condition),
    min: num(s.min),
    max: num(s.max),
    sort: str(s.sort),
    inStock: s.inStock === true || s.inStock === "true" ? true : undefined,
    sale: s.sale === true || s.sale === "true" ? true : undefined,
    page: num(s.page),
  }),
  component: Shop,
});

const SORTS = [
  ["featured", "Recommended"],
  ["newest", "Newest"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["discount", "Biggest discount"],
  ["name", "Name A–Z"],
];

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState(search.q || "");
  const [price, setPrice] = useState({ min: search.min || "", max: search.max || "" });

  useEffect(() => setQ(search.q || ""), [search.q]);
  useEffect(() => setPrice({ min: search.min || "", max: search.max || "" }), [search.min, search.max]);

  const page = search.page || 1;
  const query = useProducts({ ...search, page, limit: 24 });

  // Change one filter and go back to page 1.
  const set = (patch) => navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) });
  const category = categories.find((c) => c.slug === search.category);
  const activeCount = ["category", "brand", "condition", "min", "max", "inStock", "sale"].filter((k) => search[k]).length;

  const filters = (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2 text-sm font-semibold">Category</h4>
        <div className="flex flex-col gap-1 text-sm">
          <button onClick={() => set({ category: undefined })} className={`rounded-md px-2 py-1.5 text-left ${!search.category ? "bg-primary-soft font-semibold text-primary" : "hover:bg-muted"}`}>All categories</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => set({ category: c.slug })} className={`flex justify-between rounded-md px-2 py-1.5 text-left ${search.category === c.slug ? "bg-primary-soft font-semibold text-primary" : "hover:bg-muted"}`}>
              <span>{c.name}</span><span className="text-xs text-muted-foreground">{c.productCount}</span>
            </button>
          ))}
        </div>
      </div>

      {brands.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">Brand</h4>
          <select value={search.brand || ""} onChange={(e) => set({ brand: e.target.value || undefined })} className="input">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b.name} value={b.name}>{b.name} ({b.count})</option>)}
          </select>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold">Price (KSh)</h4>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); set({ min: num(price.min), max: num(price.max) }); }}>
          <input inputMode="numeric" value={price.min} onChange={(e) => setPrice((p) => ({ ...p, min: e.target.value.replace(/\D/g, "") }))} placeholder="Min" className="input" />
          <span className="text-muted-foreground">–</span>
          <input inputMode="numeric" value={price.max} onChange={(e) => setPrice((p) => ({ ...p, max: e.target.value.replace(/\D/g, "") }))} placeholder="Max" className="input" />
          <button className="btn-secondary btn-sm h-10">Go</button>
        </form>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Condition</h4>
        <div className="flex flex-wrap gap-2">
          {[["", "Any"], ...Object.entries(CONDITIONS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
            <button key={k} onClick={() => set({ condition: k || undefined })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${(search.condition || "") === k ? "border-primary bg-primary text-white" : "hover:border-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!search.sale} onChange={(e) => set({ sale: e.target.checked || undefined })} className="h-4 w-4 accent-primary" />
        On offer only 🔥
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!search.inStock} onChange={(e) => set({ inStock: e.target.checked || undefined })} className="h-4 w-4 accent-primary" />
        In stock only
      </label>

      {activeCount > 0 && (
        <button onClick={() => navigate({ search: { q: search.q, sort: search.sort } })} className="btn-outline btn-sm w-full">Clear filters</button>
      )}
    </div>
  );

  return (
    <div className="container-x py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{category?.name || (search.q ? `Results for “${search.q}”` : search.sale ? "Hot deals" : "All products")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{query.data ? `${query.data.total} product${query.data.total === 1 ? "" : "s"}` : "Loading…"}</p>
        </div>
        <div className="flex gap-2">
          <form className="relative flex-1 sm:w-64" onSubmit={(e) => { e.preventDefault(); set({ q: str(q) }); }}>
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input pl-9" />
          </form>
          <select value={search.sort || "featured"} onChange={(e) => set({ sort: e.target.value === "featured" ? undefined : e.target.value })} className="input w-auto">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => setShowFilters(true)} className="btn-outline lg:hidden"><FiFilter />{activeCount > 0 && <span className="badge bg-primary text-white">{activeCount}</span>}</button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">{filters}</aside>

        <div>
          {query.isPending ? (
            <ProductGridSkeleton count={12} />
          ) : query.isError ? (
            <ErrorBox error={query.error} onRetry={query.refetch} />
          ) : query.data.items.length === 0 ? (
            <EmptyState icon={FiSearch} title="No products found" text="Try a different search or remove some filters."
              action={<button onClick={() => navigate({ search: {} })} className="btn-primary">Show all products</button>} />
          ) : (
            <div className={query.isFetching ? "opacity-60 transition-opacity" : ""}>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
                {query.data.items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              <Pagination page={page} pages={query.data.pages} onChange={(p) => { navigate({ search: (prev) => ({ ...prev, page: p }) }); window.scrollTo({ top: 0 }); }} />
            </div>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setShowFilters(false)}>
          <aside className="slide-in absolute right-0 top-0 h-full w-80 max-w-[85vw] overflow-y-auto bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Filters</h3>
              <button onClick={() => setShowFilters(false)} aria-label="Close filters"><FiX size={22} /></button>
            </div>
            {filters}
            <button onClick={() => setShowFilters(false)} className="btn-primary mt-6 w-full">Show results</button>
          </aside>
        </div>
      )}
    </div>
  );
}
