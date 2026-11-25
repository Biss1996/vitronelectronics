import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { FiClock, FiCreditCard, FiHeadphones, FiMail, FiMapPin, FiPhone, FiShield, FiTruck } from "react-icons/fi";
import { useCategories, useSettings } from "../lib/queries.js";
import { displayPhone } from "../lib/format.js";
import { waLink } from "../lib/whatsapp.js";
import { directionsUrl, mapQuery } from "../lib/maps.js";
import Logo from "./Logo.jsx";

const SOCIAL_ICONS = { facebook: FaFacebookF, instagram: FaInstagram, tiktok: FaTiktok, x: FaXTwitter };

const PROMISES = [
  [FiCreditCard, "Pay on delivery"],
  [FiShield, "Genuine & warrantied"],
  [FiTruck, "Fast delivery"],
  [FiHeadphones, "Call or WhatsApp"],
];

const RED = "bg-gradient-to-r from-primary-dark via-primary to-primary-dark text-white";
const linkCls = "text-white/80 transition-colors hover:text-white";

/* ------------------------------------------------------------------ */
/* Homepage: full footer                                               */
/* ------------------------------------------------------------------ */
function FullFooter({ barSpace }) {
  const { data: s } = useSettings();
  const { data: categories = [] } = useCategories();
  const [tab, setTab] = useState("shop");
  const socials = Object.entries(s?.socials || {}).filter(([, url]) => url);
  const storeName = s?.storeName || "Vitron Electronics";

  const sections = {
    shop: {
      title: "Shop",
      body: (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 md:grid-cols-2">
          {categories.slice(0, 6).map((c) => (
            <li key={c.id}><Link to="/shop" search={{ category: c.slug }} className={`font-display ${linkCls}`}>{c.name}</Link></li>
          ))}
          <li><Link to="/shop" search={{ sale: true, sort: "discount" }} className="font-semibold text-white hover:underline">Hot deals</Link></li>
        </ul>
      ),
    },
    help: {
      title: "Help",
      body: (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 md:grid-cols-1">
          <li><Link to="/track" className={linkCls}>Track order</Link></li>
          <li><Link to="/account" className={linkCls}>My account</Link></li>
          <li><Link to="/wishlist" className={linkCls}>Wishlist</Link></li>
          <li><Link to="/about" className={linkCls}>About us</Link></li>
          <li><Link to="/contact" className={linkCls}>Contact us</Link></li>
        </ul>
      ),
    },
    contact: {
      title: "Contact",
      body: (
        <ul className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-1">
          {s?.contactPhone && <li><a href={`tel:${s.contactPhone}`} className={`flex items-center gap-2 ${linkCls}`}><FiPhone className="shrink-0" size={13} /> {displayPhone(s.contactPhone)}</a></li>}
          {s?.whatsappNumber && <li><a href={waLink(s.whatsappNumber, `Hi ${storeName}!`)} target="_blank" rel="noreferrer" className={`flex items-center gap-2 ${linkCls}`}><FaWhatsapp className="shrink-0" size={13} /> WhatsApp us</a></li>}
          {s?.contactEmail && <li><a href={`mailto:${s.contactEmail}`} className={`flex items-center gap-2 break-all ${linkCls}`}><FiMail className="shrink-0" size={13} /> {s.contactEmail}</a></li>}
          {s?.address && <li><a href={directionsUrl(mapQuery(s))} target="_blank" rel="noreferrer" className={`flex items-start gap-2 ${linkCls}`}><FiMapPin className="mt-0.5 shrink-0" size={13} /> <span>{s.address} <span className="whitespace-nowrap font-semibold text-white underline">Directions</span></span></a></li>}
          {s?.businessHours && <li className="flex items-center gap-2 text-white/80"><FiClock className="shrink-0" size={13} /> {s.businessHours}</li>}
        </ul>
      ),
    },
  };

  return (
    <footer className={`mt-10 sm:mt-14 ${barSpace} ${RED}`}>
      {/* Promise strip: one slim row */}
      <div className="border-b border-white/15">
        <div className="container-x no-scrollbar flex gap-5 overflow-x-auto py-2.5 text-[11px] font-medium sm:justify-between sm:text-xs">
          {PROMISES.map(([Icon, label]) => (
            <span key={label} className="flex shrink-0 items-center gap-1.5 text-white/90"><Icon size={14} /> {label}</span>
          ))}
        </div>
      </div>

      <div className="container-x py-6 text-xs sm:text-sm md:grid md:grid-cols-[1.2fr_1.4fr_0.9fr_1.2fr] md:gap-8 md:py-8">
        {/* Brand row */}
        <div className="flex items-center justify-between gap-4 md:block">
          <div>
            <Logo white className="h-8 md:h-10" name={storeName} />
            <p className="mt-2 hidden max-w-xs leading-relaxed text-white/75 md:block">{s?.tagline || "Smart life. Genuine electronics, pay on delivery."}</p>
          </div>
          {socials.length > 0 && (
            <div className="flex gap-1.5 md:mt-4">
              {socials.map(([k, url]) => {
                const Icon = SOCIAL_ICONS[k];
                return (
                  <a key={k} href={url} target="_blank" rel="noreferrer" aria-label={k}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white/15 transition-colors hover:bg-white hover:text-primary md:h-8 md:w-8">
                    {Icon && <Icon size={12} />}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* Phones & small tablets: headings side by side as tabs, one section shown */}
        <div className="mt-5 md:hidden">
          <div role="tablist" className="flex gap-1 rounded-full bg-white/10 p-1">
            {Object.entries(sections).map(([key, sec]) => (
              <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={`flex-1 rounded-full py-1.5 font-display text-sm font-bold transition-colors ${tab === key ? "bg-white text-primary" : "text-white/85 hover:text-white"}`}>
                {sec.title}
              </button>
            ))}
          </div>
          <div className="mt-3.5 min-h-[4.5rem]">{sections[tab].body}</div>
        </div>

        {/* Desktop: columns */}
        {Object.entries(sections).map(([key, sec]) => (
          <div key={key} className="hidden md:block">
            <h4 className="mb-3 font-display text-base font-bold">{sec.title}</h4>
            {sec.body}
          </div>
        ))}
      </div>

      <div className="border-t border-white/15">
        <div className="container-x flex flex-col items-center justify-between gap-0.5 py-3 text-center text-[11px] text-white/70 sm:flex-row">
          <p>© {new Date().getFullYear()} {storeName}. All rights reserved.</p>
          <p>Smart life · Pay on delivery</p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Inner pages: one slim red bar                                       */
/* ------------------------------------------------------------------ */
function SlimFooter({ barSpace }) {
  const { data: s } = useSettings();
  const storeName = s?.storeName || "Vitron Electronics";
  return (
    <footer className={`mt-10 ${barSpace} ${RED}`}>
      <div className="container-x flex flex-col items-center gap-1.5 py-3 text-xs sm:flex-row sm:justify-between">
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-medium text-white/85">
          <Link to="/track" className="hover:text-white">Track order</Link>
          <Link to="/contact" className="hover:text-white">Contact</Link>
          <Link to="/about" className="hover:text-white">About</Link>
          {s?.address && <Link to="/contact" className="flex items-center gap-1 hover:text-white"><FiMapPin size={12} /> Our shop</Link>}
          {s?.contactPhone && <a href={`tel:${s.contactPhone}`} className="flex items-center gap-1 hover:text-white"><FiPhone size={12} /> {displayPhone(s.contactPhone)}</a>}
          {s?.whatsappNumber && (
            <a href={waLink(s.whatsappNumber, `Hi ${storeName}!`)} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white">
              <FaWhatsapp size={13} /> WhatsApp
            </a>
          )}
        </nav>
        <p className="text-[11px] text-white/70">© {new Date().getFullYear()} <span className="font-semibold text-white">{storeName}</span></p>
      </div>
    </footer>
  );
}

// Pages that are better without a footer (keep the customer focused).
const NO_FOOTER = ["/checkout", "/login", "/register", "/forgot-password"];

export default function Footer() {
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  if (NO_FOOTER.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  // Product pages have a sticky buy bar on phones; leave room so it doesn't cover the footer.
  const barSpace = pathname.startsWith("/product/") ? "pb-16 lg:pb-0" : "";
  return pathname === "/" ? <FullFooter barSpace={barSpace} /> : <SlimFooter barSpace={barSpace} />;
}
