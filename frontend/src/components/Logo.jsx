import { Link } from "@tanstack/react-router";

/**
 * Vitron "Smart life" logo, optionally followed by the store name.
 * white    = white version for red backgrounds
 * showName = print the store name (e.g. "Vitron Electronics") beside the logo
 */
export default function Logo({ white = false, to = "/", className = "h-9 sm:h-10", name, showName = false, nameClassName = "" }) {
  const storeName = name || "Vitron Electronics";
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-3" aria-label={`${storeName} home`}>
      <img src={white ? "/logo-white.png" : "/logo.png"} alt={storeName} className={`w-auto select-none ${className}`} draggable="false" />
      {showName && (
        <span className={`border-l pl-3 font-display font-bold leading-none ${white ? "border-white/40 text-white" : "border-primary/30 text-primary"} ${nameClassName}`}>
          {storeName}
        </span>
      )}
    </Link>
  );
}
