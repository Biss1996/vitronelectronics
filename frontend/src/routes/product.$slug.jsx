import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiChevronRight, FiCreditCard, FiHeart, FiShare2, FiShield, FiShoppingCart, FiTruck } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";
import ProductCard from "../components/ProductCard.jsx";
import ProductImage from "../components/ProductImage.jsx";
import QtyStepper from "../components/QtyStepper.jsx";
import { ErrorBox } from "../components/States.jsx";
import { useCart, useWishlist } from "../context/AppProviders.jsx";
import { useProduct, useSettings } from "../lib/queries.js";
import { CONDITIONS, formatKES, warrantyLabel } from "../lib/format.js";
import { toast } from "../lib/toast.js";
import { productEnquiry, waLink } from "../lib/whatsapp.js";

export const Route = createFileRoute("/product/$slug")({ component: ProductPage });

function Gallery({ images, name, discount }) {
  const [i, setI] = useState(0);
  const touch = useRef(null);
  useEffect(() => setI(0), [images]);
  const count = images.length;
  const go = (n) => count && setI(((n % count) + count) % count);

  return (
    <div>
      <div
        className="relative aspect-square overflow-hidden rounded-xl border bg-white sm:rounded-2xl"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - (touch.current ?? 0);
          if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        <ProductImage src={images[i]} alt={name} className="h-full w-full p-5 sm:p-8" iconSize={40} />
        {discount > 0 && <span className="badge absolute left-3 top-3 bg-primary text-white">-{discount}%</span>}
        {count > 1 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 sm:hidden">
            {images.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-4 bg-primary" : "w-1.5 bg-zinc-300"}`} />
            ))}
          </div>
        )}
      </div>
      {count > 1 && (
        <div className="no-scrollbar mt-2.5 hidden gap-2 overflow-x-auto sm:flex">
          {images.map((src, n) => (
            <button key={src + n} onClick={() => setI(n)} aria-label={`Image ${n + 1}`}
              className={`h-16 w-16 shrink-0 rounded-lg border-2 bg-white p-1 transition-colors ${n === i ? "border-primary" : "border-border hover:border-zinc-300"}`}>
              <ProductImage src={src} className="h-full w-full" iconSize={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Collapsible on phones, always open from sm up. */
function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b py-4 sm:border-0 sm:py-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left sm:pointer-events-none sm:mb-3">
        <h2 className="text-base font-bold sm:text-lg">{title}</h2>
        <FiChevronDown className={`text-muted-foreground transition-transform sm:hidden ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`${open ? "mt-3 block" : "hidden"} sm:mt-0 sm:block`}>{children}</div>
    </section>
  );
}

function PageSkeleton() {
  return (
    <div className="container-x py-4 sm:py-8">
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-10">
        <div className="skeleton aspect-square rounded-xl" />
        <div className="space-y-3">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-6 w-4/5 rounded" />
          <div className="skeleton h-7 w-40 rounded" />
          <div className="skeleton h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function ProductPage() {
  const { slug } = Route.useParams();
  const { data, isPending, isError, error, refetch } = useProduct(slug);
  const { data: settings } = useSettings();
  const cart = useCart();
  const wish = useWishlist();
  const navigate = useNavigate();
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const product = data?.product;

  // Pick the first in-stock option by default.
  useEffect(() => {
    setQty(1);
    const first = product?.variants?.find((v) => v.stock > 0) || product?.variants?.[0];
    setVariantId(first?.id || null);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) return <PageSkeleton />;
  if (isError) {
    return error.status === 404 ? (
      <div className="container-x py-20 text-center">
        <h1 className="text-xl font-bold">Product not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">It may have been removed or renamed.</p>
        <Link to="/shop" className="btn-primary mt-5">Browse products</Link>
      </div>
    ) : <div className="container-x py-12"><ErrorBox error={error} onRetry={refetch} /></div>;
  }

  const p = product;
  const variant = p.variants.find((v) => v.id === variantId) || null;
  const needsVariant = p.variants.length > 0;
  const price = variant ? variant.price : p.price;
  const stock = variant ? variant.stock : needsVariant ? 0 : p.stock;
  const compare = p.compareAtPrice && p.compareAtPrice > price ? p.compareAtPrice : null;
  const discount = compare ? Math.round((1 - price / compare) * 100) : 0;
  const cond = CONDITIONS[p.condition];
  const canBuy = stock > 0 && (!needsVariant || variant);
  const saved = wish.has(p.id);
  const warranty = warrantyLabel(p.warrantyMonths);

  const addToCart = () => cart.add(p, { variant, quantity: qty });
  const buyNow = () => { cart.add(p, { variant, quantity: qty, silent: true }); navigate({ to: "/checkout" }); };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch { /* cancelled */ }
  };

  return (
    <div className="pb-24 lg:pb-12">
      {/* Breadcrumb */}
      <nav className="container-x flex items-center gap-1 overflow-hidden whitespace-nowrap py-3 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link>
        <FiChevronRight className="shrink-0" size={12} />
        {p.category ? <Link to="/shop" search={{ category: p.category.slug }} className="hover:text-primary">{p.category.name}</Link> : <Link to="/shop" className="hover:text-primary">Shop</Link>}
        <FiChevronRight className="shrink-0" size={12} />
        <span className="truncate text-ink">{p.name}</span>
      </nav>

      <div className="container-x grid gap-5 lg:grid-cols-[1fr_1fr] lg:gap-12">
        <Gallery images={p.images} name={p.name} discount={discount} />

        {/* Details */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {p.brand && <Link to="/shop" search={{ brand: p.brand }} className="text-[11px] font-bold uppercase tracking-wider text-primary sm:text-xs">{p.brand}</Link>}
            {cond && p.condition !== "new" && <span className={`badge text-[10px] ${cond.className}`}>{cond.label}</span>}
          </div>

          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="text-lg font-bold leading-snug sm:text-2xl">{p.name}</h1>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => wish.toggle(p)} aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
                className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${saved ? "border-primary bg-primary text-white" : "text-muted-foreground hover:border-primary hover:text-primary"}`}>
                <FiHeart size={15} className={saved ? "fill-current" : ""} />
              </button>
              <button onClick={share} aria-label="Share" className="grid h-9 w-9 place-items-center rounded-full border text-muted-foreground hover:border-primary hover:text-primary">
                <FiShare2 size={15} />
              </button>
            </div>
          </div>

          {/* Price */}
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-display text-2xl font-bold text-primary sm:text-3xl">{formatKES(price)}</span>
            {compare && <span className="text-sm text-muted-foreground line-through">{formatKES(compare)}</span>}
            {compare && <span className="badge bg-primary-soft text-[11px] text-primary">Save {formatKES(compare - price)}</span>}
          </div>
          <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium sm:text-sm ${stock > 0 ? "text-success" : "text-primary"}`}>
            {stock > 0 ? <><FiCheck /> In stock{stock <= 5 && ` · only ${stock} left`}</> : "Out of stock"}
          </p>

          {/* Options */}
          {needsVariant && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-muted-foreground sm:text-sm">Option: <span className="text-ink">{variant?.label || "Choose one"}</span></p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {p.variants.map((v) => (
                  <button key={v.id} disabled={v.stock === 0} onClick={() => { setVariantId(v.id); setQty(1); }}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-40 ${v.id === variantId ? "border-primary bg-primary-50 ring-1 ring-primary" : "hover:border-zinc-400"}`}>
                    <span className="block text-xs font-semibold sm:text-sm">{v.label}</span>
                    <span className="text-[11px] text-muted-foreground sm:text-xs">{v.stock === 0 ? "Sold out" : formatKES(v.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + actions (desktop/tablet) */}
          <div className="mt-5 hidden items-center gap-2.5 lg:flex">
            <QtyStepper value={qty} max={Math.max(1, Math.min(20, stock))} onChange={setQty} />
            <button disabled={!canBuy} onClick={addToCart} className="btn-secondary h-10 flex-1"><FiShoppingCart /> Add to cart</button>
            <button disabled={!canBuy} onClick={buyNow} className="btn-primary h-10 flex-1">Buy now</button>
          </div>

          {/* Quantity (mobile; actions live in the sticky bar) */}
          <div className="mt-4 flex items-center justify-between lg:hidden">
            <span className="text-xs font-semibold text-muted-foreground">Quantity</span>
            <QtyStepper size="sm" value={qty} max={Math.max(1, Math.min(20, stock))} onChange={setQty} />
          </div>

          {settings?.whatsappNumber && (
            <a href={waLink(settings.whatsappNumber, productEnquiry(p, variant?.label))} target="_blank" rel="noreferrer"
              className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-[#25D366]/40 bg-[#25D366]/5 py-2 text-xs font-semibold text-[#128C4A] transition-colors hover:bg-[#25D366]/10 sm:text-sm">
              <FaWhatsapp size={16} /> Ask about this on WhatsApp
            </a>
          )}

          {/* Assurances */}
          <ul className="mt-4 divide-y rounded-xl border text-xs sm:text-sm">
            <li className="flex items-center gap-3 px-3.5 py-2.5"><FiCreditCard className="shrink-0 text-primary" /> <span><b className="font-semibold">Pay on delivery</b> <span className="text-muted-foreground">· cash or M-Pesa</span></span></li>
            <li className="flex items-center gap-3 px-3.5 py-2.5"><FiTruck className="shrink-0 text-primary" /> <span><b className="font-semibold">Fast delivery</b> <span className="text-muted-foreground">· same day in Nairobi</span></span></li>
            <li className="flex items-center gap-3 px-3.5 py-2.5"><FiShield className="shrink-0 text-primary" /> <span><b className="font-semibold">{warranty ? warranty[0].toUpperCase() + warranty.slice(1) : "Genuine product"}</b>{cond && <span className="text-muted-foreground"> · {cond.label.toLowerCase()}</span>}</span></li>
          </ul>
        </div>
      </div>

      {/* Specs & description */}
      {(p.specs.length > 0 || p.description) && (
        <div className="container-x mt-4 sm:mt-10 sm:grid sm:gap-8 lg:grid-cols-2">
          {p.specs.length > 0 && (
            <Section title="Specifications">
              <dl className="overflow-hidden rounded-xl border text-xs sm:text-sm">
                {p.specs.map((s, n) => (
                  <div key={n} className="grid grid-cols-[38%_1fr] border-b last:border-0 odd:bg-muted/60">
                    <dt className="px-3 py-2 font-medium text-muted-foreground sm:px-4 sm:py-2.5">{s.label}</dt>
                    <dd className="px-3 py-2 sm:px-4 sm:py-2.5">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
          {p.description && (
            <Section title="Description" defaultOpen={p.specs.length === 0}>
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{p.description}</p>
            </Section>
          )}
        </div>
      )}

      {data.related.length > 0 && (
        <section className="container-x mt-8 sm:mt-12">
          <h2 className="mb-3 text-base font-bold sm:mb-5 sm:text-xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {data.related.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      )}

      {/* Sticky buy bar (phones & tablets) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-4 py-2.5 shadow-[0_-6px_20px_-10px_rgba(0,0,0,0.15)] backdrop-blur lg:hidden"
        style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <div className="mr-1 min-w-0">
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="truncate text-sm font-bold text-primary">{formatKES(price * qty)}</p>
          </div>
          <button disabled={!canBuy} onClick={addToCart} className="btn-secondary h-10 flex-1 px-3 text-xs" aria-label="Add to cart">
            <FiShoppingCart /> Add
          </button>
          <button disabled={!canBuy} onClick={buyNow} className="btn-primary h-10 flex-[1.4] px-3 text-xs">
            {canBuy ? "Buy now" : stock === 0 ? "Sold out" : "Choose option"}
          </button>
        </div>
      </div>
    </div>
  );
}
