import { useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiPlus, FiTrash2, FiUpload, FiX } from "react-icons/fi";
import Field from "../Field.jsx";
import ProductImage from "../ProductImage.jsx";
import { Modal, Spinner } from "../States.jsx";
import { Toggle } from "./AdminUI.jsx";
import { api } from "../../lib/api.js";
import { CONDITIONS } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";

const SPEC_PRESETS = {
  phones: ["Display", "Processor", "RAM", "Storage", "Camera", "Battery", "SIM"],
  laptops: ["Processor", "RAM", "Storage", "Display", "Graphics", "OS", "Battery"],
  tvs: ["Size", "Resolution", "Smart OS", "HDMI ports", "Refresh rate"],
  default: ["Model", "Colour", "Connectivity", "In the box"],
};

const empty = {
  name: "", brand: "", sku: "", categoryId: "", condition: "new", warrantyMonths: 12,
  price: "", compareAtPrice: "", stock: 0, description: "", images: [], specs: [], variants: [],
  featured: false, isNew: true, active: true,
};

function fromProduct(p) {
  if (!p) return { ...empty };
  return {
    name: p.name, brand: p.brand || "", sku: p.sku || "", categoryId: p.category?.id || "", condition: p.condition,
    warrantyMonths: p.warrantyMonths, price: p.price, compareAtPrice: p.compareAtPrice || "", stock: p.stock,
    description: p.description || "", images: [...p.images], specs: p.specs.map((s) => ({ ...s })),
    variants: p.variants.map((v) => ({ ...v, sku: v.sku || "" })), featured: p.featured, isNew: p.isNew, active: p.active,
  };
}

export default function ProductForm({ product, categories, onClose, onSaved }) {
  const [f, setF] = useState(() => fromProduct(product));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const fileRef = useRef(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const hasVariants = f.variants.length > 0;
  const catSlug = categories.find((c) => c.id === Number(f.categoryId))?.slug;

  const upload = async (files) => {
    if (!files?.length) return;
    const form = new FormData();
    for (const file of files) form.append("file", file);
    setUploading(true);
    try {
      const d = await api("/api/admin/uploads", { method: "POST", form, timeout: 60000 });
      set("images", [...f.images, ...d.files.map((x) => x.url)].slice(0, 12));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const moveImage = (i, dir) => {
    const imgs = [...f.images];
    const j = i + dir;
    if (j < 0 || j >= imgs.length) return;
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    set("images", imgs);
  };

  const addSpecPresets = () => {
    const have = new Set(f.specs.map((s) => s.label.toLowerCase()));
    const add = (SPEC_PRESETS[catSlug] || SPEC_PRESETS.default).filter((l) => !have.has(l.toLowerCase())).map((label) => ({ label, value: "" }));
    set("specs", [...f.specs, ...add]);
  };

  const updateRow = (key, i, patch) => set(key, f[key].map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (key, i) => set(key, f[key].filter((_, idx) => idx !== i));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const body = {
      ...f,
      categoryId: f.categoryId ? Number(f.categoryId) : null,
      price: hasVariants ? 0 : Number(f.price),
      compareAtPrice: f.compareAtPrice === "" ? null : Number(f.compareAtPrice),
      stock: hasVariants ? 0 : Number(f.stock),
      warrantyMonths: Number(f.warrantyMonths) || 0,
      specs: f.specs.filter((s) => s.label.trim() && s.value.trim()),
      variants: f.variants.map((v) => ({ ...v, price: Number(v.price), stock: Number(v.stock) })),
    };
    try {
      const d = product
        ? await api(`/api/admin/products/${product.id}`, { method: "PUT", body })
        : await api("/api/admin/products", { method: "POST", body });
      toast.success(product ? "Product saved" : "Product created");
      onSaved(d.product);
    } catch (err) {
      setErrors(err.details || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal wide title={product ? `Edit: ${product.name}` : "New product"} onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        <button form="product-form" disabled={saving || uploading} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : product ? "Save changes" : "Create product"}</button>
      </>}>
      <form id="product-form" onSubmit={save} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name *" value={f.name} onChange={(e) => set("name", e.target.value)} error={errors.name} className="sm:col-span-2" required />
          <Field label="Brand" value={f.brand} onChange={(e) => set("brand", e.target.value)} error={errors.brand} placeholder="e.g. Samsung" />
          <Field as="select" label="Category" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)} error={errors.categoryId}>
            <option value="">— None —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Field>
          <Field as="select" label="Condition" value={f.condition} onChange={(e) => set("condition", e.target.value)}>
            {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Field>
          <Field label="Warranty (months)" type="number" min="0" value={f.warrantyMonths} onChange={(e) => set("warrantyMonths", e.target.value)} error={errors.warrantyMonths} />
          <Field label="SKU" value={f.sku} onChange={(e) => set("sku", e.target.value)} placeholder="Optional" />
        </div>

        {/* Price & stock */}
        <div className="rounded-xl bg-muted p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {!hasVariants && <Field label="Price (KSh) *" type="number" min="0" value={f.price} onChange={(e) => set("price", e.target.value)} error={errors.price} required />}
            <Field label="Was price (KSh)" type="number" min="0" value={f.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} error={errors.compareAtPrice} hint="Shows a crossed-out price" />
            {!hasVariants && <Field label="Stock" type="number" min="0" value={f.stock} onChange={(e) => set("stock", e.target.value)} error={errors.stock} />}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Options / variants <span className="font-normal text-muted-foreground">(e.g. 128GB, 256GB — each with its own price and stock)</span></p>
              <button type="button" onClick={() => set("variants", [...f.variants, { label: "", price: f.price || "", stock: 0, sku: "" }])} className="btn-outline btn-sm"><FiPlus /> Add option</button>
            </div>
            {errors.variants && <p className="field-error">{errors.variants}</p>}
            {f.variants.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-[1fr_110px_80px_36px] gap-2 text-xs font-medium text-muted-foreground"><span>Label</span><span>Price</span><span>Stock</span><span /></div>
                {f.variants.map((v, i) => (
                  <div key={v.id || `new-${i}`} className="grid grid-cols-[1fr_110px_80px_36px] gap-2">
                    <input className="input" value={v.label} onChange={(e) => updateRow("variants", i, { label: e.target.value })} placeholder="256GB / Black" required />
                    <input className="input" type="number" min="0" value={v.price} onChange={(e) => updateRow("variants", i, { price: e.target.value })} required />
                    <input className="input" type="number" min="0" value={v.stock} onChange={(e) => updateRow("variants", i, { stock: e.target.value })} />
                    <button type="button" onClick={() => removeRow("variants", i)} className="grid place-items-center text-muted-foreground hover:text-primary" aria-label="Remove option"><FiTrash2 /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Images */}
        <div>
          <p className="label">Images <span className="font-normal text-muted-foreground">— the first image is the main one</span></p>
          <div className="flex flex-wrap gap-3">
            {f.images.map((src, i) => (
              <div key={src + i} className={`group relative h-24 w-24 rounded-lg border-2 p-1 ${i === 0 ? "border-primary" : "border-border"}`}>
                <ProductImage src={src} className="h-full w-full" iconSize={16} />
                <div className="absolute inset-x-0 bottom-0 hidden justify-between bg-black/60 p-1 group-hover:flex">
                  <button type="button" onClick={() => moveImage(i, -1)} className="text-white" aria-label="Move left"><FiArrowLeft size={14} /></button>
                  <button type="button" onClick={() => moveImage(i, 1)} className="text-white" aria-label="Move right"><FiArrowRight size={14} /></button>
                </div>
                <button type="button" onClick={() => removeRow("images", i)} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-white" aria-label="Remove image"><FiX size={12} /></button>
              </div>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || f.images.length >= 12}
              className="grid h-24 w-24 place-items-center rounded-lg border-2 border-dashed text-muted-foreground hover:border-primary hover:text-primary">
              {uploading ? <Spinner className="h-5 w-5" /> : <span className="flex flex-col items-center gap-1 text-xs"><FiUpload size={18} /> Upload</span>}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => upload(e.target.files)} />
          </div>
          <div className="mt-3 flex gap-2">
            <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="…or paste an image link (https://…)" />
            <button type="button" className="btn-outline" disabled={!/^https?:\/\//.test(imageUrl)}
              onClick={() => { set("images", [...f.images, imageUrl.trim()].slice(0, 12)); setImageUrl(""); }}>Add</button>
          </div>
          {errors.images && <p className="field-error">{errors.images}</p>}
        </div>

        {/* Specs */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="label mb-0">Specifications</p>
            <div className="flex gap-2">
              <button type="button" onClick={addSpecPresets} className="btn-ghost btn-sm">Add common specs</button>
              <button type="button" onClick={() => set("specs", [...f.specs, { label: "", value: "" }])} className="btn-outline btn-sm"><FiPlus /> Add row</button>
            </div>
          </div>
          <div className="space-y-2">
            {f.specs.map((s, i) => (
              <div key={i} className="grid grid-cols-[160px_1fr_36px] gap-2">
                <input className="input" value={s.label} onChange={(e) => updateRow("specs", i, { label: e.target.value })} placeholder="e.g. RAM" />
                <input className="input" value={s.value} onChange={(e) => updateRow("specs", i, { value: e.target.value })} placeholder="e.g. 8GB" />
                <button type="button" onClick={() => removeRow("specs", i)} className="grid place-items-center text-muted-foreground hover:text-primary" aria-label="Remove spec"><FiTrash2 /></button>
              </div>
            ))}
            {f.specs.length === 0 && <p className="text-sm text-muted-foreground">No specs yet.</p>}
          </div>
        </div>

        <Field as="textarea" rows={4} label="Description" value={f.description} onChange={(e) => set("description", e.target.value)} error={errors.description} />

        <div className="flex flex-wrap gap-6 rounded-xl border p-4">
          <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Visible in store" />
          <Toggle checked={f.featured} onChange={(v) => set("featured", v)} label="Featured on homepage" />
          <Toggle checked={f.isNew} onChange={(v) => set("isNew", v)} label="New arrival" />
        </div>
      </form>
    </Modal>
  );
}
