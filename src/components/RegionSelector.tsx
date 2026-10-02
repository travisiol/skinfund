"use client";

import { planFor } from "@/core/funding";
import type { Region } from "@/core/types";
import { describePlan, formatRp } from "@/lib/format";

/**
 * Redemption regions, exactly as the RP-code provider lists them. A region
 * whose codes cannot cover the skin price is shown but cannot be chosen.
 */
export function RegionSelector({
  regions,
  targetRp,
  value,
  onChange,
}: {
  regions: Region[];
  targetRp: number;
  value: string | null;
  onChange: (code: string) => void;
}) {
  return (
    <fieldset>
      <legend className="eyebrow mb-3">Redemption region</legend>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {regions.map((region) => {
          const plan = planFor(targetRp, region);
          const checked = value === region.code;
          return (
            <label
              key={region.code}
              className={`flex min-h-24 gap-3 border p-4 transition-colors ${checked ? "border-teal bg-surface" : "bg-night hover:border-gold"} ${
                plan ? "cursor-pointer" : "cursor-not-allowed opacity-55"
              }`}
            >
              <input
                type="radio"
                name="region"
                className="mt-1.5 size-4 shrink-0 accent-[#58D9CB]"
                value={region.code}
                checked={checked}
                disabled={!plan}
                onChange={() => onChange(region.code)}
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-lg font-semibold text-ivory">{region.label}</span>
                  <span className="num text-sm text-gold">{region.code}</span>
                </span>
                <span className="mt-1 block text-[0.9375rem] leading-snug text-mist">{region.compatibility}</span>
                <span className="num mt-2 block text-sm text-teal">
                  {plan ? (region.exact ? `Target: ${formatRp(plan.totalRp)}` : `Code: ${describePlan(plan)}`) : `No code covers ${formatRp(targetRp)} here`}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-4 text-[0.9375rem] text-mist">
        An RP code only redeems on an account from its own region, and codes are not interchangeable between servers. Check your region in the
        League client before you choose. SKINFUND never needs your Riot login to do this.
      </p>
    </fieldset>
  );
}
