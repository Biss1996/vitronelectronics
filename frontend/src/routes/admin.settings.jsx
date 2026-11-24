import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { PageHeader, RequirePermission } from "../components/admin/AdminUI.jsx";
import Field from "../components/Field.jsx";
import { ErrorBox, PageLoader, Spinner } from "../components/States.jsx";
import { useAuth } from "../context/AppProviders.jsx";
import { api } from "../lib/api.js";
import { displayPhone } from "../lib/format.js";
import { toast } from "../lib/toast.js";

export const Route = createFileRoute("/admin/settings")({
  component: () => <RequirePermission permission="dashboard:view"><Settings /></RequirePermission>,
});

function Settings() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("settings:write");
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api("/api/admin/settings").then((d) => d.settings) });
  const [f, setF] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) setF({ ...q.data, whatsappNumber: displayPhone("+" + q.data.whatsappNumber), contactPhone: displayPhone(q.data.contactPhone) });
  }, [q.data]);

  if (q.isPending || (!f && !q.isError)) return <PageLoader />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={q.refetch} />;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setZone = (i, patch) => setF({ ...f, deliveryZones: f.deliveryZones.map((z, idx) => (idx === i ? { ...z, ...patch } : z)) });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const body = {
        ...f,
        freeDeliveryOver: Number(f.freeDeliveryOver) || 0,
        deliveryZones: f.deliveryZones.map((z) => ({ ...z, fee: Number(z.fee) })),
      };
      await api("/api/admin/settings", { method: "PUT", body });
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    } catch (err) {
      setErrors(err.details || {});
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl">
      <PageHeader title="Store settings" subtitle={canEdit ? "Changes show on the store right away." : "View only — only admins can change settings."}
        actions={canEdit && <button disabled={saving} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : "Save settings"}</button>} />

      <fieldset disabled={!canEdit} className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Orders & WhatsApp</h2>
          <Field label="WhatsApp number that receives orders *" type="tel" value={f.whatsappNumber} onChange={set("whatsappNumber")} error={errors.whatsappNumber}
            hint="Customers send their order details to this number after checkout." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Call number" type="tel" value={f.contactPhone} onChange={set("contactPhone")} error={errors.contactPhone} />
            <Field label="Email" type="email" value={f.contactEmail} onChange={set("contactEmail")} error={errors.contactEmail} />
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Delivery areas & fees</h2>
            <button type="button" onClick={() => setF({ ...f, deliveryZones: [...f.deliveryZones, { id: "", name: "", fee: 0, eta: "" }] })} className="btn-outline btn-sm"><FiPlus /> Add area</button>
          </div>
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_100px_1fr_36px] gap-2 text-xs font-medium text-muted-foreground sm:grid"><span>Area name</span><span>Fee (KSh)</span><span>Delivery time</span><span /></div>
            {f.deliveryZones.map((z, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_36px] gap-2 sm:grid-cols-[1fr_100px_1fr_36px]">
                <input className="input" value={z.name} onChange={(e) => setZone(i, { name: e.target.value })} placeholder="e.g. Nairobi CBD" required />
                <input className="input" type="number" min="0" value={z.fee} onChange={(e) => setZone(i, { fee: e.target.value })} required />
                <input className="input col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" value={z.eta || ""} onChange={(e) => setZone(i, { eta: e.target.value })} placeholder="e.g. Same day" />
                <button type="button" disabled={f.deliveryZones.length <= 1} onClick={() => setF({ ...f, deliveryZones: f.deliveryZones.filter((_, idx) => idx !== i) })}
                  className="grid place-items-center text-muted-foreground hover:text-primary disabled:opacity-30" aria-label="Remove area"><FiTrash2 /></button>
              </div>
            ))}
          </div>
          <Field label="Free delivery for orders over (KSh)" type="number" min="0" value={f.freeDeliveryOver} onChange={set("freeDeliveryOver")} error={errors.freeDeliveryOver} hint="Set 0 to turn off free delivery." className="max-w-xs" />
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Store details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name *" value={f.storeName} onChange={set("storeName")} error={errors.storeName} />
            <Field label="Business hours" value={f.businessHours} onChange={set("businessHours")} />
          </div>
          <Field label="Tagline" value={f.tagline} onChange={set("tagline")} />
          <Field label="Top banner message" value={f.announcement} onChange={set("announcement")} hint="Shown above the menu on every page. Leave empty to hide." />
          <Field label="Address" value={f.address} onChange={set("address")} />
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Social links</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.keys(f.socials).map((k) => (
              <Field key={k} label={k[0].toUpperCase() + k.slice(1)} value={f.socials[k]} error={errors[`socials.${k}`]} placeholder="https://…"
                onChange={(e) => setF({ ...f, socials: { ...f.socials, [k]: e.target.value } })} />
            ))}
          </div>
        </section>
      </fieldset>
    </form>
  );
}
