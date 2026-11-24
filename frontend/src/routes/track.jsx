import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FiPackage, FiSearch } from "react-icons/fi";
import Field from "../components/Field.jsx";
import OrderView from "../components/OrderView.jsx";
import { Spinner } from "../components/States.jsx";
import { api, qs } from "../lib/api.js";

export const Route = createFileRoute("/track")({
  validateSearch: (s) => ({
    number: typeof s.number === "string" ? s.number : undefined,
    phone: typeof s.phone === "string" ? s.phone : undefined,
  }),
  component: Track,
});

function Track() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/track" });
  const [number, setNumber] = useState(search.number || "");
  const [phone, setPhone] = useState(search.phone || "");

  useEffect(() => { setNumber(search.number || ""); setPhone(search.phone || ""); }, [search.number, search.phone]);

  const enabled = Boolean(search.number && search.phone);
  const query = useQuery({
    queryKey: ["track", search.number, search.phone],
    queryFn: () => api(`/api/orders/track${qs({ number: search.number, phone: search.phone })}`).then((d) => d.order),
    enabled,
    retry: false,
    refetchInterval: 60_000,
  });

  const submit = (e) => {
    e.preventDefault();
    navigate({ search: { number: number.trim().toUpperCase(), phone: phone.trim() } });
  };

  return (
    <div className="container-x max-w-3xl py-10">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary"><FiPackage size={24} /></div>
        <h1 className="mt-4 text-3xl font-bold">Track your order</h1>
        <p className="mt-1 text-muted-foreground">Enter your order number and the phone number you used at checkout.</p>
      </div>

      <form onSubmit={submit} className="card mt-8 grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Order number" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="VTR-XXXXXX" required />
        <Field label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" required />
        <button className="btn-primary h-[42px]" disabled={query.isFetching}>{query.isFetching ? <Spinner className="h-4 w-4" /> : <FiSearch />} Track</button>
      </form>

      {enabled && (
        <div className="mt-6">
          {query.isPending ? null : query.isError ? (
            <div className="card p-6 text-center text-sm">
              <p className="font-semibold text-primary">{query.error.message}</p>
              <p className="mt-1 text-muted-foreground">Check the order number (it starts with VTR-) and the phone number.</p>
            </div>
          ) : (
            <div className="card p-5 sm:p-6"><OrderView order={query.data} /></div>
          )}
        </div>
      )}
    </div>
  );
}
