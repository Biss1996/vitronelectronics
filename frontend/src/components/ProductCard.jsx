import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FiCheck, FiEye, FiHeart, FiShoppingCart } from "react-icons/fi";
import { useCart, useWishlist } from "../context/AppProviders.jsx";
import { CONDITIONS, formatKES } from "../lib/format.js";
import ProductImage from "./ProductImage.jsx";

export default function ProductCard({ product: p }) {
  const cart = useCart();
  const wish = useWishlist();
  const [added, setAdded] = useState(false);
  const hasVariants = p.variants?.length > 0;
  const cond = CONDITIONS[p.condition];
  const saved = wish.has(p.id);

  const add = () => {
    cart.add(p);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_18px_40px_-18px_rgba(227,21,31,0.35)]">
      <div className="relative">
        <Link to="/product/$slug" params={{ slug: p.slug }} className="block aspect-square overflow-hidden bg-white p-4">
          <ProductImage src={p.images?.[0]} alt={p.name} className="h-full w-full transition-transform duration-500 group-hover:scale-110" />
        </Link>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
          {p.discountPercent > 0 && <span className="badge bg-primary text-white shadow-sm">-{p.discountPercent}%</span>}
          {p.condition !== "new" && cond && <span className={`badge ${cond.className}`}>{cond.short}</span>}
          {p.isNew && p.condition === "new" && <span className="badge bg-primary-soft text-primary">New</span>}
        </div>

        {/* Quick actions */}
        <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5">
          <button onClick={() => wish.toggle(p)} aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
            className={`grid h-9 w-9 place-items-center rounded-full border bg-white shadow-sm transition-all hover:scale-110 ${saved ? "border-primary bg-primary text-white" : "text-muted-foreground hover:border-primary hover:text-primary"}`}>
            <FiHeart className={saved ? "fill-current" : ""} size={15} />
          </button>
          <Link to="/product/$slug" params={{ slug: p.slug }} aria-label="View product"
            className="grid h-9 w-9 translate-x-12 place-items-center rounded-full border bg-white text-muted-foreground shadow-sm transition-all duration-300 hover:border-primary hover:text-primary group-hover:translate-x-0">
            <FiEye size={15} />
          </Link>
        </div>

        {!p.inStock && (
          <div className="absolute inset-0 grid place-items-center bg-white/70 backdrop-blur-[1px]">
            <span className="badge border border-primary bg-white px-3 py-1 text-primary">Out of stock</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col border-t border-border/70 p-3.5">
        {p.brand && <p className="text-[11px] font-bold uppercase tracking-wider text-primary/80">{p.brand}</p>}
        <Link to="/product/$slug" params={{ slug: p.slug }} className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug transition-colors hover:text-primary">
          {p.name}
        </Link>
        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-lg font-bold text-primary">
              {hasVariants && <span className="text-xs font-medium text-muted-foreground">From </span>}
              {formatKES(p.price)}
            </span>
            {p.compareAtPrice && <span className="text-xs text-muted-foreground line-through">{formatKES(p.compareAtPrice)}</span>}
          </div>
          {hasVariants ? (
            <Link to="/product/$slug" params={{ slug: p.slug }} className="btn-secondary btn-sm mt-2.5 w-full py-2">Choose option</Link>
          ) : (
            <button disabled={!p.inStock} onClick={add}
              className={`btn-sm btn mt-2.5 w-full py-2 ${added ? "bg-success text-white" : "bg-primary-soft text-primary hover:bg-primary hover:text-white"}`}>
              {added ? <><FiCheck /> Added</> : <><FiShoppingCart /> {p.inStock ? "Add to cart" : "Sold out"}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
