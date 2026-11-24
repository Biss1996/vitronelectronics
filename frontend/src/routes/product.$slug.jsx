import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FiCheck, FiHeart, FiShield, FiTruck, FiCreditCard } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";
import ProductCard from "../components/ProductCard.jsx";
import ProductImage from "../components/ProductImage.jsx";
import QtyStepper from "../components/QtyStepper.jsx";
import { ErrorBox, PageLoader } from "../components/States.jsx";
import { useCart, useWishlist } from "../context/AppProviders.jsx";
import { useProduct, useSettings } from "../lib/queries.js";
import { CONDITIONS, formatKES, warrantyLabel } from "../lib/format.js";
import { productEnquiry, waLink } from "../lib/whatsapp.js";

export const Route = createFileRoute("/product/$slug")({ component: ProductPage });

function ProductPage() {
  const { slug } = Route.useParams();
  const { data, isPending, isError, error, refetch } = useProduct(slug);
  const { data: settings } = useSettings();
  const cart = useCart();
  const wish = useWishlist();
  const navigate = useNavigate();
  const [img, setImg] = useState(0);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);

  const product = data?.product;

  // Pick the first in-stock variant by default.
  useEffect(() => {
    setImg(0);
    setQty(1);
    const first = product?.variants?.find((v) => v.stock > 0) || product?.variants?.[0];
    setVariantId(first?.id || null);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isPending) return <PageLoader />;
  if (isError) {
    return error.status === 404 ? (
      <div className="container-x py-24 text-center">
        <h1 className="text-2xl font-bold">Product not found</h1>
        <p className="mt-2 text-muted-foreground">It may have been removed or renamed.</p>
        <Link to="/shop" className="btn-primary mt-6">Browse products</Link>
      </div>
    ) : <div className="container-x py-16"><ErrorBox error={error} onRetry={refetch} /></div>;
  }

  const p = product;
  const variant = p.variants.find((v) => v.id === variantId) || null;
  const needsVariant = p.variants.length > 0;
  const price = variant ? variant.price : p.price;
  const stock = variant ? variant.stock : needsVariant ? 0 : p.stock;
  const compare = p.compareAtPrice && p.compareAtPrice > price ? p.compareAtPrice : null;
  const cond = CONDITIONS[p.condition];
  const canBuy = stock > 0 && (!needsVariant || variant);

  const addToCart = () => cart.add(p, { variant, quantity: qty });
  const buyNow = () => { cart.add(p, { variant, quantity: qty, silent: true }); navigate({ to: "/checkout" }); };

  return (
    <div className="container-x py-6 sm:py-10">
      <nav className="mb-5 flex flex-wrap gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link> /
        <Link to="/shop" className="hover:text-primary">Shop</Link>
        {p.category && <>/ <Link to="/shop" search={{ category: p.category.slug }} className="hover:text-primary">{p.category.name}</Link></>}
        / <span className="text-ink">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Gallery */}
        <div>
          <div className="card aspect-square overflow-hidden p-6">
            <ProductImage src={p.images[img]} alt={p.name} className="h-full w-full" iconSize={48} />
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {p.images.map((src, i) => (
                <button key={src + i} onClick={() => setImg(i)} className={`h-20 w-20 shrink-0 rounded-lg border-2 p-1 ${i === img ? "border-primary" : "border-border"}`}>
                  <ProductImage src={src} className="h-full w-full" iconSize={16} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {p.brand && <Link to="/shop" search={{ brand: p.brand }} className="text-xs font-bold uppercase tracking-wider text-primary">{p.brand}</Link>}
            {cond && <span className={`badge ${cond.className}`}>{cond.label}</span>}
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{p.name}</h1>

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="font-display text-3xl font-bold text-ink">{formatKES(price)}</span>
            {compare && <>
              <span className="text-lg text-muted-foreground line-through">{formatKES(compare)}</span>
              <span className="badge bg-primary text-white">Save {formatKES(compare - price)}</span>
            </>}
          </div>

          {needsVariant && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Choose option</p>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => (
                  <button key={v.id} onClick={() => { setVariantId(v.id); setQty(1); }} disabled={v.stock === 0}
                    className={`rounded-lg border-2 px-4 py-2 text-left text-sm transition-colors disabled:opacity-40 ${v.id === variantId ? "border-primary bg-primary-soft" : "border-border hover:border-ink"}`}>
                    <span className="block font-semibold">{v.label}</span>
                    <span className="text-xs text-muted-foreground">{v.stock === 0 ? "Sold out" : formatKES(v.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 text-sm">
            {stock > 0 ? (
              <span className="flex items-center gap-1.5 font-medium text-success"><FiCheck /> In stock{stock <= 5 && ` — only ${stock} left`}</span>
            ) : (
              <span className="font-medium text-primary">Out of stock</span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <QtyStepper value={qty} max={Math.max(1, Math.min(20, stock))} onChange={setQty} />
            <button disabled={!canBuy} onClick={addToCart} className="btn-secondary flex-1 py-3">Add to cart</button>
            <button onClick={() => wish.toggle(p)} className={`grid h-11 w-11 place-items-center rounded-lg border ${wish.has(p.id) ? "border-primary text-primary" : ""}`} aria-label="Save to wishlist">
              <FiHeart className={wish.has(p.id) ? "fill-current" : ""} />
            </button>
          </div>
          <button disabled={!canBuy} onClick={buyNow} className="btn-primary mt-3 w-full py-3.5 text-base">Buy now — pay on delivery</button>
          {settings?.whatsappNumber && (
            <a href={waLink(settings.whatsappNumber, productEnquiry(p, variant?.label))} target="_blank" rel="noreferrer" className="btn-whatsapp mt-3 w-full py-3">
              <FaWhatsapp size={18} /> Ask about this on WhatsApp
            </a>
          )}

          <div className="mt-6 grid gap-3 rounded-xl bg-muted p-4 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2"><FiCreditCard className="text-primary" /> Pay on delivery</div>
            <div className="flex items-center gap-2"><FiTruck className="text-primary" /> Fast delivery</div>
            <div className="flex items-center gap-2"><FiShield className="text-primary" /> {warrantyLabel(p.warrantyMonths) || "Genuine product"}</div>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        {p.specs.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-bold">Specifications</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {p.specs.map((s, i) => (
                    <tr key={i} className="border-b last:border-0 odd:bg-muted/50">
                      <th className="w-2/5 px-4 py-3 text-left font-medium text-muted-foreground">{s.label}</th>
                      <td className="px-4 py-3">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {p.description && (
          <div>
            <h2 className="mb-4 text-xl font-bold">Description</h2>
            <p className="whitespace-pre-line leading-relaxed text-zinc-700">{p.description}</p>
          </div>
        )}
      </div>

      {data.related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-5 text-2xl font-bold">You may also like</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
            {data.related.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      )}
    </div>
  );
}
