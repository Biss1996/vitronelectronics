import { FaWhatsapp } from "react-icons/fa6";
import { useSettings } from "../lib/queries.js";
import { waLink } from "../lib/whatsapp.js";

export default function FloatingWhatsApp() {
  const { data: s } = useSettings();
  if (!s?.whatsappNumber) return null;
  return (
    <a
      href={waLink(s.whatsappNumber, `Hi ${s.storeName}, I have a question.`)}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105"
    >
      <FaWhatsapp size={28} />
    </a>
  );
}
