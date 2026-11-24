import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import Field from "../components/Field.jsx";
import { Spinner } from "../components/States.jsx";
import { useAuth } from "../context/AppProviders.jsx";

const safeRedirect = (r) => (typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : undefined);

export const Route = createFileRoute("/register")({
  validateSearch: (s) => ({ redirect: safeRedirect(s.redirect) }),
  component: Register,
});

function Register() {
  const { register } = useAuth();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setErrors({});
    setLoading(true);
    try {
      await register(form);
      navigate({ to: redirect || "/account" });
    } catch (err) {
      setError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-x flex justify-center py-14">
      <form onSubmit={submit} className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Create an account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Orders you placed before with this phone number will show up in your account.</p>
        {error && <p className="mt-4 rounded-lg bg-primary-soft p-3 text-sm font-medium text-primary">{error}</p>}
        <div className="mt-5 space-y-4">
          <Field label="Full name" value={form.fullName} onChange={set("fullName")} error={errors.fullName} autoComplete="name" required />
          <Field label="Phone number" type="tel" value={form.phone} onChange={set("phone")} error={errors.phone} placeholder="0712 345 678" autoComplete="tel" required />
          <Field label="Email (optional)" type="email" value={form.email} onChange={set("email")} error={errors.email} autoComplete="email" />
          <Field label="Password" type="password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 6 characters" autoComplete="new-password" required />
        </div>
        <button disabled={loading} className="btn-primary mt-6 w-full py-3">{loading ? <Spinner className="h-4 w-4" /> : "Create account"}</button>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" search={{ redirect }} className="font-semibold text-primary">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
