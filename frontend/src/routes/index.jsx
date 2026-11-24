import { Link, createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { FiArrowRight, FiChevronLeft, FiChevronRight, FiCreditCard, FiPackage, FiTruck } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";
import HeroSlider from "../components/HeroSlider.jsx";
import ProductCard from "../components/ProductCard.jsx";
import ProductImage from "../components/ProductImage.jsx";
import { ErrorBox, ProductGridSkeleton } from "../components/States.jsx";
import { useBrands, useCategories, useProducts, useSettings } from "../lib/queries.js";
import { formatKES } from "../lib/format.js";
import { waLink } from "../lib/whatsapp.js";

export const Route = createFileRoute("/")({ component: Home });

function SectionTitle({ title, subtitle, to, search, linkText = "View all" }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <span className="h-7 w-1.5 rounded-full bg-primary" /> {title}
        </h2>
        {subtitle && <p className="mt-1 pl-[18px] text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {to && (
        <Link to={to} search={search} className="group flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
          {linkText} <FiArrowRight className="transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

/** Horizontal, swipeable row of product cards with arrow buttons on desktop. */
function ProductRail({ query }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  if (query.isPending) return <ProductGridSkeleton count={4} />;
  if (query.isError) return <ErrorBox error={query.error} onRetry={query.refetch} />;
  if (!query.data.items.length) return <p className="text-sm text-muted-foreground">Nothing here yet — check back soon.</p>;
  return (
    <div className="group/rail relative">
      <div ref={ref} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0">
        {query.data.items.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%]"><ProductCard product={p} /></div>
        ))}
      </div>
      {query.data.items.length > 4 && (
        <>
          <button onClick={() => scroll(-1)} aria-label="Scroll left" className="absolute -left-4 top-1/3 hidden h-11 w-11 place-items-center rounded-full border bg-white text-primary shadow-lg transition-all hover:bg-primary hover:text-white group-hover/rail:grid"><FiChevronLeft size={20} /></button>
          <button onClick={() => scroll(1)} aria-label="Scroll right" className="absolute -right-4 top-1/3 hidden h-11 w-11 place-items-center rounded-full border bg-white text-primary shadow-lg transition-all hover:bg-primary hover:text-white group-hover/rail:grid"><FiChevronRight size={20} /></button>
        </>
      )}
    </div>
  );
}

function Home() {
  const { data: settings } = useSettings();
  const { data: categories = [], isPending: catsLoading } = useCategories();
  const { data: brands = [] } = useBrands();
  const offers = useProducts({ sale: true, sort: "discount", limit: 6 });
  const featured = useProducts({ featured: true, limit: 8 });
  const newArrivals = useProducts({ new: true, sort: "newest", limit: 8 });

  // Slider: products on offer; fall back to featured products if nothing is discounted.
  const slides = offers.data?.items?.length ? offers.data.items : (featured.data?.items || []).slice(0, 5);
  const slidesLoading = offers.isPending || (!offers.data?.items?.length && featured.isPending);
  const freeOver = settings?.freeDeliveryOver || 0;

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white">
        <div className="container-x grid gap-4 py-5 sm:py-7 lg:grid-cols-[1fr_300px]">
          <HeroSlider products={slides} loading={slidesLoading} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="card relative flex flex-col justify-between overflow-hidden p-6">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-soft" />
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-[var(--shadow-lift)]"><FiCreditCard size={22} /></div>
                <h3 className="mt-4 text-xl font-bold leading-snug">No upfront payment.<br /><span className="text-primary">Pay on delivery.</span></h3>
                <p className="mt-2 text-sm text-muted-foreground">Check your item first, then pay cash or M-Pesa to our rider.</p>
              </div>
              <Link to="/shop" className="relative mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">Start shopping <FiArrowRight /></Link>
            </div>
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-white shadow-[var(--shadow-lift)]">
              <div className="pointer-events-none absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-white/10" />
              <div className="relative">
                <FiTruck size={28} />
                <h3 className="mt-3 text-xl font-bold leading-snug">{freeOver > 0 ? <>Free delivery over {formatKES(freeOver)}</> : "Fast delivery countrywide"}</h3>
                <p className="mt-2 text-sm text-white/85">Same-day in Nairobi. Track every order online.</p>
              </div>
              <Link to="/track" className="relative mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5"><FiPackage /> Track order</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-x py-10">
        <SectionTitle title="Shop by category" to="/shop" />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 lg:grid-cols-10">
          {catsLoading && Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton h-32 w-28 shrink-0 rounded-2xl sm:w-auto" />)}
          {categories.map((c) => (
            <Link key={c.id} to="/shop" search={{ category: c.slug }}
              className="group flex w-28 shrink-0 flex-col items-center gap-2.5 rounded-2xl border border-transparent p-2 text-center transition-all hover:-translate-y-1 hover:border-primary/20 hover:bg-primary-50 sm:w-auto">
              <div className="relative aspect-square w-full overflow-hidden rounded-full bg-primary-soft ring-2 ring-transparent transition-all group-hover:ring-primary">
                <ProductImage src={c.image} alt={c.name} fit="cover" className="h-full w-full transition-transform duration-500 group-hover:scale-110" iconSize={20} />
              </div>
              <span className="text-xs font-semibold leading-tight group-hover:text-primary sm:text-sm">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Hot deals */}
      {(offers.isPending || offers.data?.items?.length > 0) && (
        <section className="bg-primary-50 py-12">
          <div className="container-x">
            <SectionTitle title="🔥 Hot deals" subtitle="Biggest savings right now" to="/shop" search={{ sale: true, sort: "discount" }} linkText="All deals" />
            <ProductRail query={offers} />
          </div>
        </section>
      )}

      <section className="container-x py-12">
        <SectionTitle title="Featured products" subtitle="Hand-picked best sellers" to="/shop" search={{ sort: "featured" }} />
        <ProductRail query={featured} />
      </section>

      {/* Promo banner */}
      <section className="container-x">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-dark via-primary to-brand px-8 py-10 text-white sm:px-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-white/5" />
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-white/80">Need help choosing?</p>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Talk to us on WhatsApp</h2>
              <p className="mt-2 max-w-lg text-white/85">Tell us your budget and what you need — we'll recommend the right product and deliver it.</p>
            </div>
            {settings?.whatsappNumber && (
              <a href={waLink(settings.whatsappNumber, "Hi! I'd like help choosing a product.")} target="_blank" rel="noreferrer" className="btn-white px-6 py-3 text-base">
                <FaWhatsapp className="text-[#25D366]" size={20} /> Chat with us
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="container-x py-12">
        <SectionTitle title="New arrivals" subtitle="Just landed in store" to="/shop" search={{ sort: "newest" }} />
        <ProductRail query={newArrivals} />
      </section>

      {/* Brands marquee */}
      {brands.length > 0 && (
        <section className="border-y bg-white py-8">
          <div className="container-x">
            <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Top brands we stock</p>
          </div>
          <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <div className="marquee flex w-max gap-4">
              {[...brands, ...brands].map((b, i) => (
                <Link key={`${b.name}-${i}`} to="/shop" search={{ brand: b.name }}
                  className="whitespace-nowrap rounded-full border-2 border-border px-6 py-2.5 font-display text-lg font-bold text-zinc-400 transition-colors hover:border-primary hover:text-primary">
                  {b.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
