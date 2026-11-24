import { useRouterState } from "@tanstack/react-router";
import { FaWhatsapp } from "react-icons/fa6";
import { useSettings } from "../lib/queries.js";
import { waLink } from "../lib/whatsapp.js";

export default function FloatingWhatsApp() {
  const { data: s } = useSettings();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  if (!s?.whatsappNumber) return null;
  // Product pages have a sticky buy bar on phones/tablets — sit above it there.
  const aboveBar = pathname.startsWith("/product/");
  return (
    <a
      href={waLink(s.whatsappNumber, `Hi ${s.storeName}, I have a question.`)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className={`fixed right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 sm:right-5 sm:h-14 sm:w-14 ${aboveBar ? "bottom-20 lg:bottom-5" : "bottom-4 sm:bottom-5"}`}
    >
      <FaWhatsapp className="h-6 w-6 sm:h-7 sm:w-7" />
    </a>
  );
}
