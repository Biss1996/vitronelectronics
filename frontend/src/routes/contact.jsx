import { createFileRoute } from "@tanstack/react-router";
import { FaWhatsapp } from "react-icons/fa6";
import { FiClock, FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import { useSettings } from "../lib/queries.js";
import { displayPhone } from "../lib/format.js";
import { waLink } from "../lib/whatsapp.js";

export const Route = createFileRoute("/contact")({ component: Contact });

function Contact() {
  const { data: s } = useSettings();
  if (!s) return null;
  const rows = [
    s.contactPhone && [FiPhone, "Call us", displayPhone(s.contactPhone), `tel:${s.contactPhone}`],
    s.contactEmail && [FiMail, "Email", s.contactEmail, `mailto:${s.contactEmail}`],
    s.address && [FiMapPin, "Location", s.address],
    s.businessHours && [FiClock, "Hours", s.businessHours],
  ].filter(Boolean);

  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-4xl font-bold">Contact us</h1>
      <p className="mt-2 text-muted-foreground">The fastest way to reach us is WhatsApp.</p>
      {s.whatsappNumber && (
        <a href={waLink(s.whatsappNumber, `Hi ${s.storeName}!`)} target="_blank" rel="noreferrer" className="btn-whatsapp mt-6 px-8 py-3 text-base">
          <FaWhatsapp size={20} /> Chat on WhatsApp
        </a>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map(([Icon, label, value, href]) => (
          <div key={label} className="card flex items-start gap-3 p-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Icon /></div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              {href ? <a href={href} className="font-semibold hover:text-primary">{value}</a> : <p className="font-semibold">{value}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
