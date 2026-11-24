import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FiLogOut, FiPackage, FiChevronDown } from "react-icons/fi";
import Field from "../components/Field.jsx";
import OrderView from "../components/OrderView.jsx";
import { EmptyState, ErrorBox, PageLoader, Pagination, Spinner } from "../components/States.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AppProviders.jsx";
import { api } from "../lib/api.js";
import { displayPhone, formatDate, formatKES } from "../lib/format.js";
import { toast } from "../lib/toast.js";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  const { user, loading, logout, isStaff } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: "/account" } });
  }, [loading, user, navigate]);

  if (!user) return <PageLoader />;

  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Hi, {user.fullName.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">{displayPhone(user.phone)}</p>
        </div>
        <div className="flex gap-2">
          {isStaff && <Link to="/admin" className="btn-secondary">Admin panel</Link>}
          <button onClick={() => { logout(); navigate({ to: "/" }); }} className="btn-outline"><FiLogOut /> Sign out</button>
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <MyOrders />
        <div className="space-y-6">
          <Profile />
          <ChangePassword />
        </div>
      </div>
    </div>
  );
}

function MyOrders() {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const q = useQuery({ queryKey: ["my-orders", page], queryFn: () => api(`/api/me/orders?page=${page}&limit=10`) });

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold">My orders</h2>
      {q.isPending ? <PageLoader /> : q.isError ? <ErrorBox error={q.error} onRetry={q.refetch} /> : q.data.items.length === 0 ? (
        <div className="card"><EmptyState icon={FiPackage} title="No orders yet" action={<Link to="/shop" className="btn-primary">Start shopping</Link>} /></div>
      ) : (
        <div className="space-y-3">
          {q.data.items.map((o) => (
            <div key={o.id} className="card overflow-hidden">
              <button onClick={() => setOpenId(openId === o.id ? null : o.id)} className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/50">
                <div className="flex-1">
                  <p className="font-semibold">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}</p>
                </div>
                <StatusBadge status={o.status} />
                <span className="hidden font-semibold sm:block">{formatKES(o.total)}</span>
                <FiChevronDown className={`transition-transform ${openId === o.id ? "rotate-180" : ""}`} />
              </button>
              {openId === o.id && <OrderDetail number={o.orderNumber} />}
            </div>
          ))}
          <Pagination page={page} pages={q.data.pages} onChange={setPage} />
        </div>
      )}
    </section>
  );
}

function OrderDetail({ number }) {
  const q = useQuery({ queryKey: ["my-order", number], queryFn: () => api(`/api/me/orders/${number}`).then((d) => d.order) });
  return (
    <div className="border-t p-4 sm:p-5">
      {q.isPending ? <PageLoader /> : q.isError ? <ErrorBox error={q.error} onRetry={q.refetch} /> : <OrderView order={q.data} />}
    </div>
  );
}

function Profile() {
  const { user, saveSession } = useAuth();
  const [form, setForm] = useState({ fullName: user.fullName, email: user.email || "" });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const d = await api("/api/me", { method: "PATCH", body: form });
      saveSession(d.user);
      toast.success("Profile saved");
    } catch (err) {
      setErrors(err.details || {});
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <h2 className="font-semibold">Profile</h2>
      <Field label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} error={errors.fullName} />
      <Field label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
      <button disabled={saving} className="btn-secondary w-full">{saving ? <Spinner className="h-4 w-4" /> : "Save"}</button>
    </form>
  );
}

function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/me/password", { method: "POST", body: form });
      setForm({ currentPassword: "", newPassword: "" });
      toast.success("Password changed");
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };
  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <h2 className="font-semibold">Change password</h2>
      <Field label="Current password" type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" required />
      <Field label="New password" type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" hint="At least 6 characters" required />
      <button disabled={saving} className="btn-outline w-full">{saving ? <Spinner className="h-4 w-4" /> : "Update password"}</button>
    </form>
  );
}
