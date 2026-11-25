import { FiClock, FiMapPin, FiNavigation, FiPhone } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";
import { useSettings } from "../lib/queries.js";
import { directionsUrl, mapEmbedUrl, mapQuery } from "../lib/maps.js";
import { displayPhone } from "../lib/format.js";
import { waLink } from "../lib/whatsapp.js";

/** "Visit our shop" card: map with pin, address, hours and quick actions. */
export default function StoreLocation({ compact = false }) {
  const { data: s } = useSettings();
  const q = mapQuery(s);
  if (!s || !q) return null;

  return (
    <div className="card overflow-hidden md:grid md:grid-cols-[1fr_1.3fr]">
      <div className="flex flex-col justify-center p-4 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Visit our shop</p>
        <h3 className="mt-1 font-display text-lg font-bold sm:text-xl">{s.storeName}</h3>
        <p className="mt-2 flex items-start gap-2 text-sm text-zinc-700"><FiMapPin className="mt-0.5 shrink-0 text-primary" /> {s.address}</p>
        {s.businessHours && <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground"><FiClock className="shrink-0 text-primary" /> {s.businessHours}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={directionsUrl(q)} target="_blank" rel="noreferrer" className="btn-primary btn-sm h-9 px-4"><FiNavigation /> Get directions</a>
          {!compact && s.contactPhone && <a href={`tel:${s.contactPhone}`} className="btn-outline btn-sm h-9 px-4"><FiPhone /> {displayPhone(s.contactPhone)}</a>}
          {!compact && s.whatsappNumber && <a href={waLink(s.whatsappNumber, `Hi ${s.storeName}, I'd like to visit the shop.`)} target="_blank" rel="noreferrer" className="btn-outline btn-sm h-9 px-4"><FaWhatsapp className="text-[#25D366]" /> WhatsApp</a>}
        </div>
      </div>
      <iframe
        title={`Map: ${s.storeName}`}
        src={mapEmbedUrl(q)}
        className={`w-full border-0 border-t md:border-l md:border-t-0 ${compact ? "h-44 md:h-full md:min-h-56" : "h-56 sm:h-72 md:h-full md:min-h-80"}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
