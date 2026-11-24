import { Link } from "@tanstack/react-router";
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { FiClock, FiCreditCard, FiMail, FiMapPin, FiPhone, FiShield, FiTruck, FiRefreshCw } from "react-icons/fi";
import { useCategories, useSettings } from "../lib/queries.js";
import { displayPhone } from "../lib/format.js";
import { waLink } from "../lib/whatsapp.js";
import Logo from "./Logo.jsx";

const SOCIAL_ICONS = { facebook: FaFacebookF, instagram: FaInstagram, tiktok: FaTiktok, x: FaXTwitter };

export default function Footer() {
  const { data: s } = useSettings();
  const { data: categories = [] } = useCategories();
  const socials = Object.entries(s?.socials || {}).filter(([, url]) => url);

  return (
    <footer className="mt-20">
      {/* Promise strip */}
      <div className="border-y bg-primary-50">
        <div className="container-x grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          {[
            [FiCreditCard, "Pay on delivery", "Cash or M-Pesa on arrival"],
            [FiShield, "Genuine & warrantied", "Straight from the brand"],
            [FiTruck, "Fast delivery", "Nairobi & countrywide"],
            [FiRefreshCw, "Easy support", "Call or WhatsApp anytime"],
          ].map(([Icon, t, d]) => (
            <div key={t} className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm"><Icon size={20} /></div>
              <div><p className="text-sm font-semibold">{t}</p><p className="text-xs text-muted-foreground">{d}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-br from-primary to-primary-dark text-white">
        <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <Logo white className="h-12" name={s?.storeName} />
            <p className="mt-3 font-display text-2xl font-bold">{s?.storeName || "Vitron Electronics"}</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/85">{s?.tagline || "Smart life. Genuine electronics delivered to your door — pay when it arrives."}</p>
            {socials.length > 0 && (
              <div className="mt-5 flex gap-2">
                {socials.map(([k, url]) => {
                  const Icon = SOCIAL_ICONS[k];
                  return (
                    <a key={k} href={url} target="_blank" rel="noreferrer" aria-label={k}
                      className="grid h-9 w-9 place-items-center rounded-full bg-white/15 transition-all hover:-translate-y-0.5 hover:bg-white hover:text-primary">
                      {Icon && <Icon size={14} />}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-display text-lg font-bold tracking-wide">Shop</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-white/85">
              {categories.slice(0, 7).map((c) => (
                <li key={c.id}><Link to="/shop" search={{ category: c.slug }} className="font-display text-[15px] transition-colors hover:text-white hover:underline">{c.name}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-lg font-bold tracking-wide">Help</h4>
            <ul className="mt-4 space-y-2.5 text-sm text-white/85">
              <li><Link to="/track" className="hover:text-white hover:underline">Track your order</Link></li>
              <li><Link to="/account" className="hover:text-white hover:underline">My account</Link></li>
              <li><Link to="/wishlist" className="hover:text-white hover:underline">Wishlist</Link></li>
              <li><Link to="/about" className="hover:text-white hover:underline">About us</Link></li>
              <li><Link to="/contact" className="hover:text-white hover:underline">Contact us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-lg font-bold tracking-wide">Get in touch</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/85">
              {s?.contactPhone && <li><a href={`tel:${s.contactPhone}`} className="flex items-center gap-2.5 hover:text-white"><FiPhone /> {displayPhone(s.contactPhone)}</a></li>}
              {s?.contactEmail && <li><a href={`mailto:${s.contactEmail}`} className="flex items-center gap-2.5 hover:text-white"><FiMail /> {s.contactEmail}</a></li>}
              {s?.address && <li className="flex items-center gap-2.5"><FiMapPin /> {s.address}</li>}
              {s?.businessHours && <li className="flex items-center gap-2.5"><FiClock /> {s.businessHours}</li>}
            </ul>
            {s?.whatsappNumber && (
              <a href={waLink(s.whatsappNumber, `Hi ${s.storeName}!`)} target="_blank" rel="noreferrer" className="btn-white mt-5">
                <FaWhatsapp className="text-[#25D366]" size={18} /> Chat on WhatsApp
              </a>
            )}
          </div>
        </div>
        <div className="border-t border-white/15">
          <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-white/75 sm:flex-row">
            <p>© {new Date().getFullYear()} {s?.storeName || "Vitron Electronics"}. All rights reserved.</p>
            <p>Smart life · Pay on delivery · Genuine products</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
