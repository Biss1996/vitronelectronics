import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FiHeart, FiMenu, FiPackage, FiPhone, FiSearch, FiShoppingCart, FiUser, FiX } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";
import { useAuth, useCart, useWishlist } from "../context/AppProviders.jsx";
import { useCategories, useSettings } from "../lib/queries.js";
import { displayPhone } from "../lib/format.js";
import { waLink } from "../lib/whatsapp.js";
import Logo from "./Logo.jsx";

function SearchBox({ onDone, className = "" }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e) => {
    e.preventDefault();
    navigate({ to: "/shop", search: { q: q.trim() || undefined } });
    onDone?.();
  };
  return (
    <form onSubmit={submit} className={`group relative ${className}`} role="search">
      <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search phones, TVs, laptops, appliances…"
        className="h-11 w-full rounded-full border-2 border-border bg-muted pl-11 pr-28 text-sm outline-none transition-all focus:border-primary focus:bg-white" aria-label="Search products" />
      <button className="absolute bottom-1 right-1 top-1 rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark">Search</button>
    </form>
  );
}

/** Small counter bubble that "pops" when the number changes. */
function CountBubble({ n }) {
  const [pop, setPop] = useState(false);
  const prev = useRef(n);
  useEffect(() => {
    if (n > prev.current) { setPop(true); const t = setTimeout(() => setPop(false), 400); prev.current = n; return () => clearTimeout(t); }
    prev.current = n;
  }, [n]);
  if (n <= 0) return null;
  return (
    <span className={`absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-white ring-2 ring-white ${pop ? "pop" : ""}`}>{n}</span>
  );
}

export default function Navbar() {
  const cart = useCart();
  const wish = useWishlist();
  const { user, isStaff } = useAuth();
  const { data: categories = [] } = useCategories();
  const { data: s } = useSettings();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useRouterState({ select: (st) => st.location });
  const activeCategory = location.pathname === "/shop" ? location.search?.category : undefined;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Top bar */}
      <div className="bg-primary text-white">
        <div className="container-x flex h-9 items-center justify-between gap-4 text-xs font-medium">
          <p className="truncate">{s?.announcement || "Genuine electronics · Pay on delivery"}</p>
          <div className="hidden shrink-0 items-center gap-5 sm:flex">
            {s?.contactPhone && <a href={`tel:${s.contactPhone}`} className="flex items-center gap-1.5 hover:underline"><FiPhone size={12} /> {displayPhone(s.contactPhone)}</a>}
            {s?.whatsappNumber && <a href={waLink(s.whatsappNumber)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:underline"><FaWhatsapp size={13} /> WhatsApp</a>}
            <Link to="/track" className="flex items-center gap-1.5 hover:underline"><FiPackage size={12} /> Track order</Link>
          </div>
        </div>
      </div>

      <header className={`sticky top-0 z-40 bg-white/95 backdrop-blur transition-shadow duration-300 ${scrolled ? "shadow-[0_6px_24px_-12px_rgba(227,21,31,0.35)]" : "border-b"}`}>
        <div className="container-x flex h-[72px] items-center gap-3 sm:gap-8">
          <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-primary-50 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><FiMenu size={22} /></button>
          <Logo className="h-8 sm:h-10" name={s?.storeName} />
          <SearchBox className="hidden flex-1 md:block md:max-w-2xl" />
          <div className="ml-auto flex items-center gap-1">
            {isStaff && <Link to="/admin" className="btn-secondary btn-sm mr-1 hidden sm:inline-flex">Admin</Link>}
            <Link to={user ? "/account" : "/login"} className="flex h-10 items-center gap-2 rounded-full px-2.5 transition-colors hover:bg-primary-50 hover:text-primary" aria-label="Account">
              <FiUser size={20} />
              <span className="hidden text-left text-xs leading-tight xl:block">
                <span className="block text-muted-foreground">{user ? "Hello," : "Sign in"}</span>
                <span className="font-semibold">{user ? user.fullName.split(" ")[0] : "Account"}</span>
              </span>
            </Link>
            <Link to="/wishlist" className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-primary-50 hover:text-primary" aria-label="Wishlist">
              <FiHeart size={20} /><CountBubble n={wish.count} />
            </Link>
            <button onClick={() => cart.setOpen(true)} className="relative ml-1 flex h-11 items-center gap-2 rounded-full bg-primary pl-3.5 pr-4 text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-[var(--shadow-lift)]" aria-label="Cart">
              <FiShoppingCart size={19} />
              <span className="hidden text-sm font-semibold sm:inline">Cart</span>
              {cart.count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-bold text-primary">{cart.count}</span>}
            </button>
          </div>
        </div>
        <div className="container-x pb-3 md:hidden"><SearchBox /></div>

        {/* Category bar */}
        <nav className="hidden border-t lg:block">
          <div className="container-x no-scrollbar flex h-12 items-center gap-1 overflow-x-auto text-sm font-medium">
            <Link to="/shop" className="mr-2 flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-soft px-4 py-1.5 font-semibold text-primary hover:bg-primary hover:text-white">
              <FiMenu size={14} /> All categories
            </Link>
            {categories.map((c) => (
              <Link key={c.id} to="/shop" search={{ category: c.slug }}
                className={`relative whitespace-nowrap px-3 py-3 transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-left after:bg-primary after:transition-transform hover:text-primary hover:after:scale-x-100 ${activeCategory === c.slug ? "text-primary after:scale-x-100" : "after:scale-x-0"}`}>
                {c.name}
              </Link>
            ))}
            <Link to="/shop" search={{ sale: true, sort: "discount" }} className="ml-auto whitespace-nowrap rounded-full px-3 py-1.5 font-semibold text-primary hover:bg-primary-50">🔥 Hot deals</Link>
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-80 max-w-[85vw] overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-primary px-5 py-4">
              <Logo white className="h-8" />
              <button onClick={() => setOpen(false)} className="text-white" aria-label="Close menu"><FiX size={22} /></button>
            </div>
            <div className="p-5">
              <SearchBox onDone={() => setOpen(false)} />
              <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shop by category</p>
              <div className="mt-2 flex flex-col">
                <Link to="/shop" onClick={() => setOpen(false)} className="py-2.5 font-semibold text-primary">All products</Link>
                {categories.map((c) => (
                  <Link key={c.id} to="/shop" search={{ category: c.slug }} onClick={() => setOpen(false)} className="border-t py-2.5 hover:text-primary">{c.name}</Link>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-1 border-t pt-4 text-sm">
                <Link to="/track" onClick={() => setOpen(false)} className="py-1.5 hover:text-primary">Track my order</Link>
                <Link to={user ? "/account" : "/login"} onClick={() => setOpen(false)} className="py-1.5 hover:text-primary">{user ? "My account" : "Sign in"}</Link>
                <Link to="/contact" onClick={() => setOpen(false)} className="py-1.5 hover:text-primary">Contact us</Link>
                {isStaff && <Link to="/admin" onClick={() => setOpen(false)} className="btn-primary mt-3">Admin panel</Link>}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
