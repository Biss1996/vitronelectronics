import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import Field from "../components/Field.jsx";
import Logo from "../components/Logo.jsx";
import { Spinner } from "../components/States.jsx";
import { useAuth } from "../context/AppProviders.jsx";

const safeRedirect = (r) => (typeof r === "string" && r.startsWith("/admin") && r !== "/admin/login" ? r : undefined);

export const Route = createFileRoute("/admin/login")({
  validateSearch: (s) => ({ redirect: safeRedirect(s.redirect) }),
  component: AdminLogin,
});

function AdminLogin() {
  const { login, logout } = useAuth();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(phone, password);
      if (!u.permissions?.includes("dashboard:view")) {
        logout();
        throw new Error("This account doesn't have admin access.");
      }
      navigate({ to: redirect || "/admin" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-brand via-primary to-primary-deep px-4">
      <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[26rem] w-[26rem] rounded-full bg-white/5" />
      <form onSubmit={submit} className="fade-up relative w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex justify-center"><Logo className="h-12" /></div>
        <h1 className="mt-6 text-center text-2xl font-bold">Admin sign in</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">For store staff and admins only.</p>
        {error && <p className="mt-4 rounded-lg bg-primary-soft p-3 text-sm font-medium text-primary">{error}</p>}
        <div className="mt-5 space-y-4">
          <Field label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="username" required />
          <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <button disabled={loading} className="btn-primary mt-6 w-full py-3">{loading ? <Spinner className="h-4 w-4" /> : "Sign in"}</button>
        <a href="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-primary">← Back to store</a>
      </form>
    </div>
  );
}
