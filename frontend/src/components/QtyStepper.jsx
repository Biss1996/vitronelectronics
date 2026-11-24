import { FiMinus, FiPlus } from "react-icons/fi";

export default function QtyStepper({ value, onChange, max = 20, size = "md" }) {
  const pad = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className="inline-flex items-center rounded-lg border">
      <button type="button" className={`${pad} grid place-items-center disabled:opacity-30`} disabled={value <= 1} onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        <FiMinus size={14} />
      </button>
      <span className="min-w-8 text-center text-sm font-semibold">{value}</span>
      <button type="button" className={`${pad} grid place-items-center disabled:opacity-30`} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Increase quantity">
        <FiPlus size={14} />
      </button>
    </div>
  );
}
