import { FiLock } from "react-icons/fi";
import { useAuth } from "../../context/AppProviders.jsx";

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Shows children only if the signed-in user has the permission. The API enforces this too. */
export function RequirePermission({ permission, children }) {
  const { can } = useAuth();
  if (can(permission)) return children;
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <FiLock className="mx-auto text-primary" size={28} />
      <p className="mt-3 font-semibold">You don't have access to this page</p>
      <p className="mt-1 text-sm text-muted-foreground">Ask an admin to change your role if you need it.</p>
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }) {
  const tones = { default: "", red: "border-primary/30 bg-primary-soft/40", solid: "bg-gradient-to-br from-primary to-primary-dark text-white border-primary" };
  return (
    <div className={`card p-4 ${tones[tone]}`}>
      <p className={`text-xs font-medium uppercase tracking-wider ${tone === "solid" ? "text-white/80" : "text-muted-foreground"}`}>{label}</p>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint && <p className={`mt-1 text-xs ${tone === "solid" ? "text-white/80" : "text-muted-foreground"}`}>{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-zinc-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
      {label}
    </label>
  );
}

export const ROLE_LABELS = {
  admin: { label: "Admin", className: "bg-primary text-white", help: "Full access: products, categories, settings and team." },
  staff: { label: "Staff", className: "bg-primary-soft text-primary", help: "Orders, stock levels, customers and dashboard." },
  customer: { label: "Customer", className: "bg-muted text-ink", help: "Shops on the store. No admin access." },
};
