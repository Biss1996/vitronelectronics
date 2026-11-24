import { Link, createFileRoute } from "@tanstack/react-router";
import { FiHeart, FiTrash2 } from "react-icons/fi";
import ProductImage from "../components/ProductImage.jsx";
import { EmptyState } from "../components/States.jsx";
import { useWishlist } from "../context/AppProviders.jsx";
import { formatKES } from "../lib/format.js";

export const Route = createFileRoute("/wishlist")({ component: Wishlist });

function Wishlist() {
  const wish = useWishlist();
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-bold">Wishlist</h1>
      {wish.items.length === 0 ? (
        <EmptyState icon={FiHeart} title="Nothing saved yet" text="Tap the heart on any product to save it here."
          action={<Link to="/shop" className="btn-primary">Browse products</Link>} />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {wish.items.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <Link to="/product/$slug" params={{ slug: p.slug }} className="block aspect-square p-4">
                <ProductImage src={p.image} alt={p.name} className="h-full w-full" />
              </Link>
              <div className="border-t p-3">
                <Link to="/product/$slug" params={{ slug: p.slug }} className="line-clamp-2 text-sm font-medium hover:text-primary">{p.name}</Link>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold">{formatKES(p.price)}</span>
                  <button onClick={() => wish.toggle(p)} className="text-muted-foreground hover:text-primary" aria-label="Remove"><FiTrash2 /></button>
                </div>
                <Link to="/product/$slug" params={{ slug: p.slug }} className="btn-primary btn-sm mt-3 w-full">View product</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
