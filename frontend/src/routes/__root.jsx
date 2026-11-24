import { Link, Outlet, createRootRouteWithContext, useRouter, useRouterState } from "@tanstack/react-router";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import CartDrawer from "../components/CartDrawer.jsx";
import FloatingWhatsApp from "../components/FloatingWhatsApp.jsx";

export const Route = createRootRouteWithContext()({
  component: Root,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function Root() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/admin")) return <Outlet />;
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
      <CartDrawer />
      <FloatingWhatsApp />
    </div>
  );
}

function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="font-display text-7xl font-bold text-primary">404</p>
      <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist or was moved.</p>
      <Link to="/" className="btn-primary mt-6">Go to homepage</Link>
    </div>
  );
}

function RouteError({ error, reset }) {
  const router = useRouter();
  return (
    <div className="container-x py-24 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">{error?.message || "Please try again."}</p>
      <button onClick={() => { reset(); router.invalidate(); }} className="btn-primary mt-6">Try again</button>
    </div>
  );
}
