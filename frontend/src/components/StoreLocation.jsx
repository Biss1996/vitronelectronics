import { FiClock, FiMapPin, FiNavigation } from "react-icons/fi";
import { useSettings } from "../lib/queries.js";
import { directionsUrl, mapEmbedUrl, mapQuery } from "../lib/maps.js";

/** Slim "Visit our shop" strip: small map thumbnail, address, hours, directions. */
export default function StoreLocation({ className = "" }) {
  const { data: s } = useSettings();
  const q = mapQuery(s);
  if (!s || !q) return null;
  const directions = directionsUrl(q);

  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-white p-2.5 sm:gap-4 sm:p-3 ${className}`}>
      {/* Map thumbnail — tapping it opens directions */}
      <a href={directions} target="_blank" rel="noreferrer" aria-label="Open map"
        className="relative block h-16 w-20 shrink-0 overflow-hidden rounded-lg border sm:h-20 sm:w-32">
        <iframe title={`Map: ${s.storeName}`} src={mapEmbedUrl(q)} className="pointer-events-none h-[160%] w-[160%] origin-top-left scale-[0.625] border-0"
          loading="lazy" referrerPolicy="no-referrer-when-downgrade" tabIndex={-1} />
      </a>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary sm:text-[11px]">Visit our shop</p>
        <p className="mt-0.5 flex items-start gap-1 text-xs font-medium leading-snug text-ink sm:text-sm">
          <FiMapPin className="mt-0.5 shrink-0 text-primary" size={12} />
          <span className="line-clamp-2">{s.address}</span>
        </p>
        {s.businessHours && (
          <p className="mt-0.5 hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
            <FiClock size={11} className="shrink-0" /> {s.businessHours}
          </p>
        )}
      </div>

      <a href={directions} target="_blank" rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary-dark sm:text-xs">
        <FiNavigation size={12} /> <span className="hidden min-[380px]:inline">Directions</span>
      </a>
    </div>
  );
}
