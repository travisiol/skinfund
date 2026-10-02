/**
 * Funding progress. `percent` is funded value ÷ funding threshold — never RP
 * already owned. With `percent` null there is no data, and the gauge says so
 * instead of showing zero.
 */
export function ProgressGauge({
  percent,
  orientation = "horizontal",
  label = "Funding progress",
  className = "",
}: {
  percent: number | null;
  orientation?: "horizontal" | "vertical";
  label?: string;
  className?: string;
}) {
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const aria = {
    role: "progressbar" as const,
    "aria-label": label,
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    ...(percent === null ? { "aria-valuetext": "No data" } : { "aria-valuenow": value, "aria-valuetext": `${value}% funded` }),
  };

  if (orientation === "vertical") {
    return (
      <div {...aria} className={`relative w-[26px] ${className}`}>
        <div className="frame absolute inset-0" style={{ "--c": "12px", "--fill": "var(--color-night)" } as React.CSSProperties}>
          <div className="cut absolute inset-[5px] flex items-end" style={{ "--c": "8px" } as React.CSSProperties}>
            <div className="reveal-fill w-full bg-teal" style={{ height: `${value}%` }} />
          </div>
        </div>
        {percent !== null && (
          <span
            className="num reveal-line absolute left-[-6px] -translate-y-1/2 bg-surface px-2 py-0.5 text-[1.625rem] leading-tight text-teal"
            style={{ top: `calc(5px + (100% - 10px) * ${1 - value / 100})` }}
          >
            {value}%
          </span>
        )}
      </div>
    );
  }

  return (
    <div {...aria} className={className}>
      <div className="h-3 border border-gold/70 bg-night p-[2px]">
        <div className="reveal-fill h-full bg-teal" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
