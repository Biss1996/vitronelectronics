import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FiKey, FiPlus, FiSearch } from "react-icons/fi";
import { PageHeader, ROLE_LABELS, RequirePermission } from "../components/admin/AdminUI.jsx";
import Field from "../components/Field.jsx";
import { ErrorBox, Modal, PageLoader, Spinner } from "../components/States.jsx";
import { useAuth } from "../context/AppProviders.jsx";
import { api, qs } from "../lib/api.js";
import { displayPhone, formatDate } from "../lib/format.js";
import { confirm, toast } from "../lib/toast.js";

export const Route = createFileRoute("/admin/team")({
  component: () => <RequirePermission permission="users:manage"><Team /></RequirePermission>,
});

function Team() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");

  const team = useQuery({ queryKey: ["admin", "users", q], queryFn: () => api(`/api/admin/users${qs({ q })}`).then((d) => d.users) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  return (
    <>
      <PageHeader title="Team & roles" subtitle="Who can access the admin panel, and what they can do."
        actions={<button onClick={() => setAdding(true)} className="btn-primary"><FiPlus /> Add team member</button>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {Object.entries(ROLE_LABELS).map(([k, r]) => (
          <div key={k} className="card p-4">
            <span className={`badge ${r.className}`}>{r.label}</span>
            <p className="mt-2 text-sm text-muted-foreground">{r.help}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <form onSubmit={(e) => { e.preventDefault(); setQ(input.trim()); }} className="relative border-b p-3">
          <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search any account by name or phone to change its role" className="input pl-9" />
        </form>
        {q && <p className="border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground">Showing accounts matching “{q}”. <button className="font-semibold text-primary" onClick={() => { setQ(""); setInput(""); }}>Show team only</button></p>}
        {team.isPending ? <PageLoader /> : team.isError ? <div className="p-6"><ErrorBox error={team.error} onRetry={team.refetch} /></div> : team.data.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No accounts found.</p>
        ) : (
          <div className="divide-y">
            {team.data.map((u) => <MemberRow key={u.id} member={u} onChanged={refresh} onResetPassword={() => setResetting(u)} />)}
          </div>
        )}
      </div>

      {adding && <AddMember onClose={() => setAdding(false)} onSaved={() => { setAdding(false); refresh(); }} />}
      {resetting && <ResetPassword member={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}

function MemberRow({ member: u, onChanged, onResetPassword }) {
  const { user: me } = useAuth();
  const [busy, setBusy] = useState(false);
  const isMe = u.id === me.id;

  const patch = async (body, message) => {
    setBusy(true);
    try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", body }); toast.success(message); onChanged(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const changeRole = async (role) => {
    if (role === u.role) return;
    const ok = await confirm({
      title: `Make ${u.fullName} ${ROLE_LABELS[role].label.toLowerCase()}?`,
      text: ROLE_LABELS[role].help,
      confirmText: "Change role",
      danger: role === "admin" || u.role === "admin",
    });
    if (ok) patch({ role }, "Role updated");
  };

  const toggleActive = async () => {
    if (u.active) {
      const ok = await confirm({ title: `Disable ${u.fullName}?`, text: "They'll be signed out and can't sign in until you enable them again.", confirmText: "Disable", danger: true });
      if (!ok) return;
    }
    patch({ active: !u.active }, u.active ? "Account disabled" : "Account enabled");
  };

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-medium">{u.fullName} {isMe && <span className="text-xs text-muted-foreground">(you)</span>} {!u.active && <span className="badge ml-1 bg-zinc-200 text-zinc-700">Disabled</span>}</p>
        <p className="text-xs text-muted-foreground">{displayPhone(u.phone)} · {u.lastLoginAt ? `last sign-in ${formatDate(u.lastLoginAt)}` : "never signed in"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={u.role} disabled={isMe || busy} onChange={(e) => changeRole(e.target.value)} className="input w-auto py-1.5 text-sm" title={isMe ? "You can't change your own role" : "Change role"}>
          <option value="customer">Customer</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={onResetPassword} className="btn-ghost btn-sm" title="Set a new password"><FiKey /> Password</button>
        {!isMe && <button disabled={busy} onClick={toggleActive} className={`btn-sm btn ${u.active ? "btn-ghost text-primary" : "btn-secondary"}`}>{u.active ? "Disable" : "Enable"}</button>}
        {busy && <Spinner className="h-4 w-4 text-primary" />}
      </div>
    </div>
  );
}

function AddMember({ onClose, onSaved }) {
  const [f, setF] = useState({ fullName: "", phone: "", email: "", password: "", role: "staff" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await api("/api/admin/users", { method: "POST", body: f }); toast.success("Team member added"); onSaved(); }
    catch (err) { setErrors(err.details || {}); toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Add team member" onClose={onClose}
      footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button form="member-form" disabled={saving} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : "Add"}</button></>}>
      <form id="member-form" onSubmit={save} className="space-y-4">
        <Field label="Full name *" value={f.fullName} onChange={set("fullName")} error={errors.fullName} required />
        <Field label="Phone number *" type="tel" value={f.phone} onChange={set("phone")} error={errors.phone} hint="They sign in with this number" required />
        <Field label="Email" type="email" value={f.email} onChange={set("email")} error={errors.email} />
        <Field label="Temporary password *" type="text" value={f.password} onChange={set("password")} error={errors.password} hint="Share it privately; they can change it under My account." required />
        <div>
          <span className="label">Role</span>
          <div className="grid gap-2">
            {["staff", "admin"].map((r) => (
              <label key={r} className={`flex cursor-pointer gap-3 rounded-lg border-2 p-3 ${f.role === r ? "border-primary bg-primary-soft/40" : ""}`}>
                <input type="radio" checked={f.role === r} onChange={() => setF({ ...f, role: r })} className="mt-0.5 accent-primary" />
                <span><span className="text-sm font-semibold">{ROLE_LABELS[r].label}</span><span className="block text-xs text-muted-foreground">{ROLE_LABELS[r].help}</span></span>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ member, onClose }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await api(`/api/admin/users/${member.id}`, { method: "PATCH", body: { password } }); toast.success("Password updated"); onClose(); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={`New password for ${member.fullName}`} onClose={onClose}
      footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button form="pw-form" disabled={saving || password.length < 6} className="btn-primary">{saving ? <Spinner className="h-4 w-4" /> : "Set password"}</button></>}>
      <form id="pw-form" onSubmit={save}>
        <Field label="New password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 6 characters. Use this to help customers who forgot their password." required />
      </form>
    </Modal>
  );
}
