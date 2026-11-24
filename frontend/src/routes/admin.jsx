import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  FiBox, FiExternalLink, FiGrid, FiLayers, FiLogOut, FiMenu, FiSettings, FiShoppingBag, FiTag, FiUserCheck, FiUsers, FiX,
} from "react-icons/fi";
import Logo from "../components/Logo.jsx";
import { PageLoader } from "../components/States.jsx";
import { ROLE_LABELS } from "../components/admin/AdminUI.jsx";
import { useAuth } from "../context/AppProviders.jsx";
import { api } from "../lib/api.js";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const NAV = [
  { to: "/admin", label: "Dashboard", icon: FiGrid, perm: "dashboard:view", exact: true },
  { to: "/admin/orders", label: "Orders", icon: FiShoppingBag, perm: "orders:view", badge: "pending" },
  { to: "/admin/products", label: "Products", icon: FiBox, perm: "products:view" },
  { to: "/admin/inventory", label: "Inventory", icon: FiLayers, perm: "stock:update" },
  { to: "/admin/categories", label: "Categories", icon: FiTag, perm: "products:view" },
  { to: "/admin/customers", label: "Customers", icon: FiUsers, perm: "customers:view" },
  { to: "/admin/team", label: "Team & roles", icon: FiUserCheck, perm: "users:manage" },
  { to: "/admin/settings", label: "Settings", icon: FiSettings, perm: "dashboard:view" },
];

function AdminLayout() {
  const { user, loading, logout, can, isStaff } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin || loading) return;
    if (!user) navigate({ to: "/admin/login", search: { redirect: pathname } });
  }, [isLogin, loading, user, navigate, pathname]);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Pending-order badge, refreshed every minute.
  const pending = useQuery({
    queryKey: ["admin", "pending-count"],
    queryFn: () => api("/api/admin/orders?status=pending&limit=1").then((d) => d.counts?.pending || 0),
    enabled: !isLogin && isStaff,
    refetchInterval: 60_000,
  });

  if (isLogin) return <Outlet />;
  if (!user) return <PageLoader />;
  if (!isStaff) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-muted-foreground">You're signed in as a customer. Ask an admin to give you a staff role.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/" className="btn-outline">Back to store</Link>
            <button onClick={() => { logout(); navigate({ to: "/admin/login" }); }} className="btn-primary">Switch account</button>
          </div>
        </div>
      </div>
    );
  }

  const role = ROLE_LABELS[user.role];
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo to="/admin" className="h-9" />
        <button className="text-muted-foreground lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Close menu"><FiX size={20} /></button>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.filter((n) => can(n.perm)).map((n) => {
          const active = n.exact ? pathname === n.to || pathname === n.to + "/" : pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-primary text-white shadow-[var(--shadow-lift)]" : "text-zinc-600 hover:bg-primary-50 hover:text-primary"}`}>
              <n.icon size={17} /> <span className="flex-1">{n.label}</span>
              {n.badge === "pending" && pending.data > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white text-primary" : "bg-primary text-white"}`}>{pending.data}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-xl bg-primary-50 p-4">
        <p className="truncate text-sm font-semibold">{user.fullName}</p>
        <span className={`badge mt-1 ${role?.className}`}>{role?.label}</span>
        <div className="mt-3 flex gap-2">
          <a href="/" target="_blank" rel="noreferrer" className="btn-sm btn flex-1 border border-primary/20 bg-white text-primary hover:bg-primary hover:text-white"><FiExternalLink /> Store</a>
          <button onClick={() => { logout(); navigate({ to: "/admin/login" }); }} className="btn-sm btn flex-1 border border-primary/20 bg-white text-primary hover:bg-primary hover:text-white"><FiLogOut /> Log out</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#faf8f8] lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen border-r bg-white lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <aside className="slide-in h-full w-72 bg-white" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white px-4 lg:hidden">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu"><FiMenu size={22} /></button>
          <Logo to="/admin" className="h-8" />
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
