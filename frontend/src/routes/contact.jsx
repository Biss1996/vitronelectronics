import { createFileRoute } from "@tanstack/react-router";
import { FaWhatsapp } from "react-icons/fa6";
import { FiMail, FiPhone } from "react-icons/fi";
import StoreLocation from "../components/StoreLocation.jsx";
import { useSettings } from "../lib/queries.js";
import { displayPhone } from "../lib/format.js";
import { waLink } from "../lib/whatsapp.js";

export const Route = createFileRoute("/contact")({ component: Contact });

function Contact() {
  const { data: s } = useSettings();
  if (!s) return null;

  return (
    <div className="container-x max-w-3xl py-6 sm:py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Contact us</h1>
      <p className="mt-1 text-sm text-muted-foreground">Visit our shop, call, or chat with us on WhatsApp — whichever suits you.</p>

      <StoreLocation className="mt-5 sm:mt-6" />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {s.whatsappNumber && (
          <a href={waLink(s.whatsappNumber, `Hi ${s.storeName}!`)} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-4 transition-colors hover:border-[#25D366]">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#25D366]/10 text-[#128C4A]"><FaWhatsapp size={18} /></span>
            <span><span className="block text-xs text-muted-foreground">WhatsApp</span><span className="text-sm font-semibold">Chat with us</span></span>
          </a>
        )}
        {s.contactPhone && (
          <a href={`tel:${s.contactPhone}`} className="card flex items-center gap-3 p-4 transition-colors hover:border-primary">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><FiPhone /></span>
            <span><span className="block text-xs text-muted-foreground">Call us</span><span className="text-sm font-semibold">{displayPhone(s.contactPhone)}</span></span>
          </a>
        )}
        {s.contactEmail && (
          <a href={`mailto:${s.contactEmail}`} className="card flex items-center gap-3 p-4 transition-colors hover:border-primary">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><FiMail /></span>
            <span className="min-w-0"><span className="block text-xs text-muted-foreground">Email</span><span className="block truncate text-sm font-semibold">{s.contactEmail}</span></span>
          </a>
        )}
      </div>
    </div>
  );
}
