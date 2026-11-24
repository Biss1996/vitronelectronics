/** Label + input + error message. Pass `as="textarea"` or `as="select"` for other controls. */
export default function Field({ label, error, hint, as: Tag = "input", className = "", children, ...props }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
      <Tag className={`input ${error ? "input-error" : ""}`} aria-invalid={!!error} {...props}>{children}</Tag>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
