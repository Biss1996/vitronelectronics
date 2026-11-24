import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import Field from "../components/Field.jsx";
import { Spinner } from "../components/States.jsx";
import { useAuth } from "../context/AppProviders.jsx";

const safeRedirect = (r) => (typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : undefined);

export const Route = createFileRoute("/login")({
  validateSearch: (s) => ({ redirect: safeRedirect(s.redirect) }),
  component: Login,
});

function Login() {
  const { login } = useAuth();
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
      const user = await login(phone, password);
      const staff = user.permissions?.includes("dashboard:view");
      navigate({ to: redirect || (staff ? "/admin" : "/account") });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-x flex justify-center py-14">
      <form onSubmit={submit} className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track orders and check out faster.</p>
        {error && <p className="mt-4 rounded-lg bg-primary-soft p-3 text-sm font-medium text-primary">{error}</p>}
        <div className="mt-5 space-y-4">
          <Field label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" autoComplete="tel" required />
          <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <div className="mt-2 text-right"><Link to="/forgot-password" className="text-xs font-medium text-primary">Forgot password?</Link></div>
        <button disabled={loading} className="btn-primary mt-5 w-full py-3">{loading ? <Spinner className="h-4 w-4" /> : "Sign in"}</button>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          New here? <Link to="/register" search={{ redirect }} className="font-semibold text-primary">Create an account</Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">You don't need an account to order — just add items and check out.</p>
      </form>
    </div>
  );
}
