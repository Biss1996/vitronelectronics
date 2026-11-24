import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";

export function Spinner({ className = "h-5 w-5" }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-primary">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function ErrorBox({ error, onRetry, className = "" }) {
  return (
    <div className={`card mx-auto max-w-lg p-6 text-center ${className}`}>
      <FiAlertTriangle className="mx-auto text-primary" size={28} />
      <p className="mt-3 font-semibold">Couldn't load this</p>
      <p className="mt-1 text-sm text-muted-foreground">{error?.message || "Something went wrong."}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-outline mt-4">
          <FiRefreshCw /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      {Icon && <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary"><Icon size={24} /></div>}
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton aspect-square" />
          <div className="space-y-2 p-3">
            <div className="skeleton h-3 w-1/3 rounded" />
            <div className="skeleton h-4 w-4/5 rounded" />
            <div className="skeleton h-5 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <div className="mt-8 flex items-center justify-center gap-1.5">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="btn-outline btn-sm">Prev</button>
      {nums.map((n) => (
        <button key={n} onClick={() => onChange(n)} className={`btn-sm btn ${n === page ? "bg-primary text-white" : "btn-ghost"}`}>{n}</button>
      ))}
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="btn-outline btn-sm">Next</button>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={`fade-up flex max-h-[95vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
