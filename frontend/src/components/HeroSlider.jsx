import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiChevronLeft, FiChevronRight, FiShoppingCart, FiZap } from "react-icons/fi";
import { useCart } from "../context/AppProviders.jsx";
import { CONDITIONS, formatKES, warrantyLabel } from "../lib/format.js";
import ProductImage from "./ProductImage.jsx";

const AUTOPLAY_MS = 6000;

// Each slide gets a slightly different red so the carousel feels alive.
const BACKGROUNDS = [
  "from-[#fd3132] via-primary to-primary-deep",
  "from-primary via-primary-dark to-primary-deep",
  "from-[#ff4d3d] via-[#e3151f] to-[#a50c15]",
  "from-[#e3151f] via-[#c8101b] to-[#7d0810]",
];

function Slide({ product: p, index, active, style }) {
  const cart = useCart();
  const hasVariants = p.variants?.length > 0;
  const save = p.compareAtPrice ? p.compareAtPrice - p.price : 0;
  const cond = CONDITIONS[p.condition];
  const anim = (c) => (active ? c : ""); // entrance animations replay each time a slide comes in

  return (
    <div className={`absolute inset-0 bg-gradient-to-br will-change-transform ${BACKGROUNDS[index % BACKGROUNDS.length]} ${active ? "" : "pointer-events-none"}`}
      style={style} aria-hidden={!active}>
      {/* decorative shapes */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative grid h-full grid-cols-[1.3fr_1fr] items-center gap-2 px-4 pb-7 pt-3 sm:gap-6 sm:px-10 sm:py-8 md:grid-cols-[1.05fr_1fr] md:gap-8 md:px-14">
        <div className="min-w-0 text-white">
          <div className={`${anim("fade-up")} flex flex-wrap items-center gap-2`}>
            {p.discountPercent > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-primary shadow sm:px-3 sm:py-1 sm:text-xs"><FiZap /> {p.discountPercent}% OFF</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-primary shadow sm:px-3 sm:py-1 sm:text-xs"><FiZap /> Featured</span>
            )}
            {p.brand && <span className="hidden rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider sm:inline">{p.brand}</span>}
            {p.condition !== "new" && cond && <span className="hidden rounded-full bg-white/15 px-3 py-1 text-xs font-semibold sm:inline">{cond.label}</span>}
          </div>
          <h2 className={`${anim("fade-up-2")} mt-2 line-clamp-2 text-base font-extrabold leading-tight sm:mt-4 sm:text-3xl lg:text-5xl`}>{p.name}</h2>
          <div className={`${anim("fade-up-2")} mt-1 flex flex-wrap items-end gap-x-2 gap-y-0 sm:mt-4 sm:gap-x-4 sm:gap-y-1`}>
            <span className="text-lg font-extrabold sm:text-3xl lg:text-4xl">{hasVariants && <span className="mr-1 text-[10px] font-medium opacity-80 sm:text-base">from</span>}{formatKES(p.price)}</span>
            {p.compareAtPrice && <span className="pb-0.5 text-[11px] text-white/70 line-through sm:pb-1 sm:text-lg">{formatKES(p.compareAtPrice)}</span>}
          </div>
          {save > 0 && <p className={`${anim("fade-up-2")} mt-1 hidden text-sm font-medium text-white/90 sm:block`}>You save {formatKES(save)} · Pay on delivery{p.warrantyMonths ? ` · ${warrantyLabel(p.warrantyMonths)}` : ""}</p>}
          <div className={`${anim("fade-up-3")} mt-2.5 flex flex-wrap gap-3 sm:mt-6`}>
            <Link to="/product/$slug" params={{ slug: p.slug }} className="btn bg-white px-3 py-1.5 text-xs text-primary shadow-lg hover:-translate-y-0.5 hover:shadow-xl sm:px-6 sm:py-3 sm:text-sm" tabIndex={active ? 0 : -1}>
              Shop deal <FiArrowRight />
            </Link>
            {!hasVariants && p.inStock && (
              <span className="hidden sm:block"><button onClick={() => cart.add(p)} className="btn border-2 border-white/60 px-5 py-3 text-white hover:bg-white/10" tabIndex={active ? 0 : -1}>
                <FiShoppingCart /> Add to cart
              </button></span>
            )}
          </div>
        </div>

        <Link to="/product/$slug" params={{ slug: p.slug }} className="relative mx-auto grid w-full max-w-[140px] place-items-center sm:max-w-[260px] md:max-w-[400px]" tabIndex={-1}>
          <div className="absolute inset-[6%] rounded-full bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)]" />
          <div className="absolute inset-[6%] animate-ping rounded-full bg-white/20 [animation-duration:3s]" />
          <ProductImage src={p.images?.[0]} alt={p.name} fit="cover" className={`${anim("zoom-in")} relative aspect-square w-[88%] rounded-full bg-white`} iconSize={48} />
          {p.discountPercent > 0 && (
            <span className="float absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full bg-white text-center text-primary shadow-xl sm:right-[2%] sm:top-[6%] sm:h-16 sm:w-16 md:h-20 md:w-20">
              <span className="leading-none"><span className="block text-xs font-extrabold sm:text-xl md:text-2xl">-{p.discountPercent}%</span><span className="hidden text-[10px] font-semibold uppercase sm:inline">deal</span></span>
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

const SLIDE_MS = 700;

export default function HeroSlider({ products = [], loading = false }) {
  // index: slide on screen. prev: slide leaving. dir: 1 = new slide comes from the right (moves right→left), -1 = from the left.
  // stage "prep": incoming slide is parked off-screen with no animation; "move": both slides animate.
  const [state, setState] = useState({ index: 0, prev: null, dir: 1, stage: "idle" });
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  const busy = useRef(false);
  const count = products.length;
  const { index } = state;

  const go = useCallback((target, dir) => {
    if (count < 2 || busy.current) return;
    target = ((target % count) + count) % count;
    if (target === index) return;
    busy.current = true;
    setState({ index, prev: null, dir, stage: "prep", target });
  }, [count, index]);

  const next = useCallback(() => go(index + 1, 1), [go, index]);
  const prev = useCallback(() => go(index - 1, -1), [go, index]);

  // After the incoming slide is painted off-screen, start the slide animation.
  useEffect(() => {
    if (state.stage !== "prep") return;
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setState((s) => ({ index: s.target, prev: s.index, dir: s.dir, stage: "move" })));
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [state.stage]);

  // Animation finished: unlock.
  useEffect(() => {
    if (state.stage !== "move") return;
    const t = setTimeout(() => { busy.current = false; setState((s) => ({ ...s, prev: null, stage: "idle" })); }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [state.stage]);

  useEffect(() => { if (index >= count && count > 0) setState({ index: 0, prev: null, dir: 1, stage: "idle" }); }, [count, index]);

  // Autoplay: always right → left.
  useEffect(() => {
    if (paused || count < 2 || state.stage !== "idle") return;
    const t = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, count, next, state.stage]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /** Where each slide sits and whether it animates there. */
  const slideStyle = (i) => {
    const off = state.dir > 0 ? "100%" : "-100%";      // side the new slide enters from
    const out = state.dir > 0 ? "-100%" : "100%";      // side the old slide leaves to
    const ease = `transform ${SLIDE_MS}ms cubic-bezier(.65,0,.35,1)`;
    if (state.stage === "prep") {
      if (i === state.index) return { transform: "translateX(0)", zIndex: 10 };
      if (i === state.target) return { transform: `translateX(${off})`, zIndex: 10, transition: "none" };
      return { transform: "translateX(100%)", transition: "none", visibility: "hidden" };
    }
    if (i === state.index) return { transform: "translateX(0)", transition: state.stage === "move" ? ease : "none", zIndex: 10 };
    if (i === state.prev) return { transform: `translateX(${out})`, transition: ease, zIndex: 9 };
    return { transform: "translateX(100%)", transition: "none", visibility: "hidden" };
  };

  if (loading) return <div className="skeleton h-[200px] rounded-2xl sm:h-[300px] sm:rounded-3xl md:h-[440px]" />;

  if (count === 0) {
    return (
      <div className="relative grid h-[200px] place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-primary to-primary-deep p-5 text-center text-white sm:h-[300px] sm:rounded-3xl sm:p-8 md:h-[440px]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/80">Smart life</p>
          <h2 className="mt-2 text-xl font-extrabold sm:mt-3 sm:text-4xl md:text-5xl">Genuine electronics, delivered.</h2>
          <p className="mt-3 text-white/85">Order online. Pay when it arrives.</p>
          <Link to="/shop" className="btn-white mt-6 px-6 py-3">Shop now <FiArrowRight /></Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative h-[200px] overflow-hidden rounded-2xl shadow-[0_24px_60px_-24px_rgba(227,21,31,0.55)] sm:h-[300px] sm:rounded-3xl md:h-[440px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
        if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
        touch.current = null;
        setPaused(false);
      }}
      onKeyDown={(e) => { if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); }}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="Offers"
    >
      {products.map((p, i) => <Slide key={p.id} product={p} index={i} active={i === index} style={slideStyle(i)} />)}

      {count > 1 && (
        <>
          <button onClick={prev} aria-label="Previous offer"
            className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 sm:grid -translate-y-1/2 place-items-center rounded-full bg-white/90 text-primary shadow-lg transition-all hover:scale-110 hover:bg-white md:opacity-0 md:group-hover:opacity-100">
            <FiChevronLeft size={22} />
          </button>
          <button onClick={next} aria-label="Next offer"
            className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 sm:grid -translate-y-1/2 place-items-center rounded-full bg-white/90 text-primary shadow-lg transition-all hover:scale-110 hover:bg-white md:opacity-0 md:group-hover:opacity-100">
            <FiChevronRight size={22} />
          </button>

          {/* Dots with autoplay progress */}
          <div className="absolute bottom-2.5 left-4 z-20 flex items-center gap-1.5 sm:bottom-5 sm:left-10 sm:gap-2 md:left-14">
            {products.map((p, i) => (
              <button key={p.id} onClick={() => go(i, i > index ? 1 : -1)} aria-label={`Show offer ${i + 1}: ${p.name}`}
                className={`relative h-2 overflow-hidden rounded-full bg-white/35 transition-all duration-300 ${i === index ? "w-7 sm:w-10" : "w-2 hover:bg-white/60"}`}>
                {i === index && (
                  <span key={`${index}-${paused}-${state.stage}`} className="absolute inset-0 origin-left rounded-full bg-white"
                    style={{ animation: paused || state.stage !== "idle" ? "none" : `vt-progress ${AUTOPLAY_MS}ms linear forwards`, transform: paused ? "scaleX(1)" : state.stage !== "idle" ? "scaleX(0)" : undefined }} />
                )}
              </button>
            ))}
          </div>
          <span className="absolute bottom-2 right-4 z-20 text-[10px] font-semibold text-white/80 sm:bottom-4 sm:right-6 sm:text-xs">{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
        </>
      )}
    </div>
  );
}
