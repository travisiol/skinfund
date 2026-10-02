"use client";

import { usePot } from "@/lib/client-data";
import { formatDate, formatMoney } from "@/lib/format";

const FIELDS = ["In holders' funds", "Rewards recorded", "Spent on RP codes", "Last distribution"] as const;

/** Pool numbers, straight from the operator's record of distributions. Never a made-up counter. */
export function Pot() {
  const { data, error } = usePot();
  const pot = data?.available ? data.pot : null;
  const values = pot
    ? [formatMoney(pot.inFunds), formatMoney(pot.recorded), formatMoney(pot.spent), pot.updatedAt ? formatDate(pot.updatedAt) : "None yet"]
    : null;

  return (
    <div>
      <dl className="grid border-t border-l sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map((label, index) => (
          <div key={label} className="border-r border-b p-5 sm:p-6">
            <dt className="text-mist">{label}</dt>
            <dd className="num mt-2 text-2xl text-ivory">{values ? values[index] : "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5" aria-live="polite">
        {pot ? (
          <p className="max-w-4xl text-mist">
            <span className="eyebrow mr-2">Methodology</span>
            {pot.methodology}
            {pot.holders > 0 && ` Recorded so far across ${pot.holders} wallet${pot.holders === 1 ? "" : "s"}.`}
          </p>
        ) : (
          <p className="notice">{error ? "Pot data could not be loaded. Reload the page to try again." : data && !data.available ? `Pot data unavailable: ${data.needs}.` : "Loading pot data…"}</p>
        )}
      </div>
    </div>
  );
}
