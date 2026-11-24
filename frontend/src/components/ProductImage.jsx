import { useState } from "react";
import { FiImage } from "react-icons/fi";

/** Image with a clean fallback when the URL is missing or broken. */
export default function ProductImage({ src, alt = "", className = "", iconSize = 28, fit = "contain" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`grid place-items-center bg-muted text-muted-foreground ${className}`}>
        <FiImage size={iconSize} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`${fit === "cover" ? "object-cover" : "object-contain"} ${className}`} />;
}
