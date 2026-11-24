import { Link, createFileRoute } from "@tanstack/react-router";
import { FiCheckCircle, FiShield, FiTruck } from "react-icons/fi";
import { useSettings } from "../lib/queries.js";

export const Route = createFileRoute("/about")({ component: About });

function About() {
  const { data: s } = useSettings();
  const name = s?.storeName || "Vitron";
  return (
    <div className="container-x max-w-4xl py-12">
      <h1 className="text-4xl font-bold">About {name}</h1>
      <p className="mt-4 text-lg leading-relaxed text-zinc-700">
        {name} sells genuine phones, laptops, TVs, audio and accessories across Kenya. We keep it simple:
        honest prices, real warranties, and you only pay when your order is in your hands.
      </p>
      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {[
          [FiShield, "Genuine products", "Sourced from authorised distributors, with warranty."],
          [FiCheckCircle, "Pay on delivery", "No upfront payment. Check your item, then pay cash or M-Pesa."],
          [FiTruck, "Fast delivery", "Same or next day in Nairobi, 1–3 days countrywide."],
        ].map(([Icon, t, d]) => (
          <div key={t} className="card p-5">
            <Icon className="text-primary" size={24} />
            <h3 className="mt-3 font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
      <Link to="/shop" className="btn-primary mt-10">Shop now</Link>
    </div>
  );
}
