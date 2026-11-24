import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { PageHeader, RequirePermission, Toggle } from "../components/admin/AdminUI.jsx";
import Field from "../components/Field.jsx";
import ProductImage from "../components/ProductImage.jsx";
import { ErrorBox, Modal, PageLoader, Spinner } from "../components/States.jsx";
import { useAuth } from "../context/AppProviders.jsx";
import { api } from "../lib/api.js";
import { confirm, toast } from "../lib/toast.js";

export const Route = createFileRoute("/admin/categories")({
  component: () => <RequirePermission permission="products:view"><Categories /></RequirePermission>,
});

function Categories() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const canWrite = can("categories:write");
  const q = useQuery({ queryKey: ["admin", "categories"], queryFn: () => api("/api/admin/categories").then((d) => d.categories) });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const remove = async (c) => {
    const ok = await confirm({ title: `Delete “${c.name}”?`, text: `${c.productCount} product(s) in it will become uncategorised.`, confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await api(`/api/admin/categories/${c.id}`, { method: "DELETE" }); toast.success("Category deleted"); refresh(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Categories" subtitle="These appear in the store menu, in this order."
        actions={canWrite && <button onClick={() => setEditing({})} className="btn-primary"><FiPlus /> Add category</button>} />
      {q.isPending ? <PageLoader /> : q.isError ? <ErrorBox error={q.error} onRetry={q.refetch} /> : (
        <div className="card divide-y">
          {q.data.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No categories yet.</p>}
          {q.data.map((c) => (
            <div key={c.id} className="flex items-center gap-4 p-4">
              <ProductImage src={c.image} className="h-12 w-16 shrink-0 rounded border object-cover" iconSize={14} />
              <div className="flex-1">
                <p className="font-medium">{c.name} {!c.active && <span className="badge ml-1 bg-zinc-200 text-zinc-700">Hidden</span>}</p>
                <p className="text-xs text-muted-foreground">/{c.slug} · {c.productCount} products · order {c.sortOrder}</p>
              </div>
              {canWrite && (
                <div className="flex gap-1">
                  <button onClick={() => setEditing(c)} className="btn-ghost btn-sm"><FiEdit2 /></button>
                  <button onClick={() => remove(c)} className="btn-ghost btn-sm text-primary"><FiTrash2 /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {editing && <CategoryForm category={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </>
  );
}

function CategoryForm({ category, onClose, onSaved }) {
  const isNew = !category.id;
  const [f, setF] = useState({
    name: category.name || "", image: category.image || "", sortOrder: category.sortOrder ?? 0, active: category.active ?? true,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try { const d = await api("/api/admin/uploads", { method: "POST", form, timeout: 60000 }); setF((x) => ({ ...x, image: d.files[0].url })); }
    catch (e) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...f, sortOrder: Number(f.sortOrder) || 0, image: f.image || null };
      if (isNew) await api("/api/admin/categories", { method: "POST", body });
      else await api(`/api/admin/categories/${category.id}`, { method: "PUT", body });
      toast.success("Category saved");
      onSaved();
    } catch (err) {
      setErrors(err.details || {});
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={isNew ? "New category" : `Edit: ${category.name}`} onClose={onClose}
      footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button form="cat-form" disabled={saving || uploading} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : "Save"}</button></>}>
      <form id="cat-form" onSubmit={save} className="space-y-4">
        <Field label="Name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} required />
        <div>
          <span className="label">Image</span>
          <div className="flex items-center gap-3">
            <ProductImage src={f.image} className="h-16 w-20 rounded border object-cover" iconSize={16} />
            <label className="btn-outline btn-sm cursor-pointer">{uploading ? <Spinner className="h-3 w-3" /> : "Upload"}
              <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>
          <input className="input mt-2" value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} placeholder="…or paste an image link" />
          {errors.image && <p className="field-error">{errors.image}</p>}
        </div>
        <Field label="Menu order" type="number" min="0" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} hint="Lower numbers show first" />
        <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Show in store" />
      </form>
    </Modal>
  );
}
