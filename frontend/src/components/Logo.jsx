import { Link } from "@tanstack/react-router";

/** Vitron "Smart life" logo. `white` = white version for red backgrounds. */
export default function Logo({ white = false, to = "/", className = "h-9 sm:h-10", name = "Vitron Electronics" }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center" aria-label={`${name} home`}>
      <img src={white ? "/logo-white.png" : "/logo.png"} alt={name} className={`w-auto select-none ${className}`} draggable="false" />
    </Link>
  );
}
