import { useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiDownloadCloud, FiExternalLink, FiFileText } from "react-icons/fi";
import { Modal, Spinner } from "../States.jsx";
import ProductImage from "../ProductImage.jsx";
import ProductForm from "./ProductForm.jsx";
import { api } from "../../lib/api.js";
import { formatKES } from "../../lib/format.js";

const MAX_LINKS = 20;

/** Admin → Products → Import: paste Jumia / Kilimall links, review, save. */
export default function ImportDialog({ categories, onClose, onImported }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState([]); // { key, url, status: loading|ready|duplicate|error|saved, draft, info, error, existing, pasted }
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(null);

  const update = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const preview = async (row, body) => {
    update(row.key, { status: "loading", error: null });
    try {
      const d = await api("/api/admin/import/preview", { method: "POST", body, timeout: 60000 });
      update(row.key, {
        status: d.existing ? "duplicate" : "ready",
        draft: d.draft,
        existing: d.existing,
        info: { source: d.source, url: d.url || row.url, sku: d.draft.sku || null, price: d.draft.price || null, oldPrice: d.draft.compareAtPrice || null, allowDuplicate: Boolean(d.existing) },
      });
    } catch (err) {
      update(row.key, { status: "error", error: err.message });
    }
  };

  const fetchAll = async () => {
    const links = [...new Set(text.split(/\s+/).map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l)))].slice(0, MAX_LINKS);
    if (!links.length) return;
    const fresh = links.map((url, i) => ({ key: `${Date.now()}-${i}`, url, status: "loading" }));
    setRows(fresh);
    setBusy(true);
    for (const row of fresh) {
      await preview(row, { url: row.url });
      await new Promise((r) => setTimeout(r, 400)); // be gentle with the source site
    }
    setBusy(false);
  };

  if (reviewing) {
    return (
      <ProductForm
        draft={reviewing.draft}
        importInfo={reviewing.info}
        categories={categories}
        onClose={() => setReviewing(null)}
        onSaved={(product) => {
          update(reviewing.key, { status: "saved", product });
          setReviewing(null);
          onImported?.(product);
        }}
      />
    );
  }

  const count = text.split(/\s+/).filter((l) => /^https?:\/\//i.test(l)).length;

  return (
    <Modal wide title="Import products" onClose={onClose}
      footer={<button onClick={onClose} className="btn-ghost">Done</button>}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="import-links">Jumia or Kilimall product links</label>
          <textarea id="import-links" className="input min-h-28 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={"https://www.jumia.co.ke/…\nhttps://www.kilimall.co.ke/…"} />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">One link per line, up to {MAX_LINKS}. Name, price, specs and all photos are copied into your store, and products go live when you save them.</p>
            <button onClick={fetchAll} disabled={busy || count === 0} className="btn-primary btn-sm shrink-0">
              {busy ? <Spinner className="h-3.5 w-3.5" /> : <FiDownloadCloud />} Fetch {count > 1 ? `${Math.min(count, MAX_LINKS)} links` : "link"}
            </button>
          </div>
        </div>

        {rows.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {rows.map((r) => <Row key={r.key} row={r} onReview={() => setReviewing(r)} onPaste={(t) => preview(r, { url: r.url, text: t })} />)}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function Row({ row: r, onReview, onPaste }) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const d = r.draft;

  return (
    <li className="p-3 text-sm">
      <div className="flex items-center gap-3">
        <ProductImage src={d?.images?.[0]} className="h-12 w-12 shrink-0 rounded border p-0.5" iconSize={14} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{d?.name || r.url}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.status === "loading" && "Reading page…"}
            {d && r.status !== "loading" && <>{d.price ? formatKES(d.price) : "No price found"} · {d.images.length} photo{d.images.length === 1 ? "" : "s"} · {d.specs.length} specs</>}
            {r.status === "error" && <span className="text-primary">{r.error}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {r.status === "loading" && <Spinner className="h-4 w-4 text-primary" />}
          {r.status === "ready" && <button onClick={onReview} className="btn-primary btn-sm">Review</button>}
          {r.status === "duplicate" && (
            <>
              <span className="badge bg-amber-100 text-amber-800"><FiAlertTriangle /> Already imported</span>
              <button onClick={onReview} className="btn-ghost btn-sm" title="Import a second copy anyway">Review</button>
            </>
          )}
          {r.status === "saved" && (
            <>
              <span className="badge bg-green-100 text-green-800"><FiCheckCircle /> Live</span>
              <a href={`/product/${r.product.slug}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><FiExternalLink /></a>
            </>
          )}
          {r.status === "error" && <button onClick={() => setPasting((v) => !v)} className="btn-outline btn-sm"><FiFileText /> Paste text</button>}
        </div>
      </div>
      {r.status === "duplicate" && r.existing && <p className="mt-1 pl-15 text-xs text-muted-foreground">Existing product: “{r.existing.name}”</p>}
      {pasting && r.status === "error" && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">Open the product page, select all (Ctrl+A), copy (Ctrl+C) and paste it here. Photos can then be added in the review form.</p>
          <textarea className="input min-h-24 text-xs" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste the product page text…" />
          <button onClick={() => { onPaste(pasted); setPasting(false); }} disabled={!pasted.trim()} className="btn-primary btn-sm">Read pasted text</button>
        </div>
      )}
    </li>
  );
}
