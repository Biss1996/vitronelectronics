import { Link, createFileRoute } from "@tanstack/react-router";
import { FaWhatsapp } from "react-icons/fa6";
import { useSettings } from "../lib/queries.js";
import { waLink } from "../lib/whatsapp.js";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const { data: s } = useSettings();
  return (
    <div className="container-x flex justify-center py-14">
      <div className="card w-full max-w-md p-6 text-center sm:p-8">
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Message us on WhatsApp from the phone number on your account and we'll reset it for you.
        </p>
        {s?.whatsappNumber && (
          <a href={waLink(s.whatsappNumber, "Hi, I forgot my account password. Please help me reset it.")} target="_blank" rel="noreferrer" className="btn-whatsapp mt-6 w-full py-3">
            <FaWhatsapp size={18} /> Reset via WhatsApp
          </a>
        )}
        <p className="mt-4 text-xs text-muted-foreground">You can still order without signing in, and track orders with your order number.</p>
        <Link to="/login" className="btn-ghost mt-4">Back to sign in</Link>
      </div>
    </div>
  );
}
