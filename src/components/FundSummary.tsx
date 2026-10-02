import { estimateRp, progress } from "@/core/funding";
import type { FundingTarget, Money, Skin } from "@/core/types";
import { describePlan, formatMoney, formatRp } from "@/lib/format";
import { ProgressGauge } from "./ProgressGauge";

function Row({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 border-b py-3 last:border-b-0">
      <dt className="text-mist">{label}</dt>
      <dd className="ml-auto text-right font-medium text-ivory">
        {children}
        {note && <span className="block text-sm font-normal text-mist">{note}</span>}
      </dd>
    </div>
  );
}

const pending = <span className="chip">Not configured</span>;

/**
 * The fund at a glance. `target` and `funded` are null until the provider and
 * the reward source are configured; the rows then say so rather than show 0.
 */
export function FundSummary({
  skin,
  regionLabel,
  target,
  funded,
  valuationBasis,
  tag,
}: {
  skin: Skin;
  regionLabel: string | null;
  target: FundingTarget | null;
  funded: Money | null;
  valuationBasis?: string;
  /** e.g. "Example" on the homepage, "Claimed" on a finished fund. */
  tag?: string;
}) {
  const p = target && funded ? progress(funded, target.threshold) : null;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="eyebrow">Fund summary</span>
        {tag && <span className="chip chip-teal">{tag}</span>}
      </div>
      <div className="flex items-end justify-between gap-4">
        <span className="num text-[2.5rem] leading-none text-teal">{p ? `${p.percent}%` : "—"}</span>
        <span className="text-right text-[0.9375rem] text-mist">{p ? (p.funded ? "Fully funded" : "funded toward the RP code") : "No funding data"}</span>
      </div>
      <ProgressGauge percent={p ? p.percent : null} className="mt-3" />
      <dl className="mt-4">
        <Row label="Selected skin" note={skin.champion}>
          {skin.name}
        </Row>
        <Row label="Region">{regionLabel ?? pending}</Row>
        <Row label="Target RP" note="Listed store price">
          <span className="num">{skin.rp !== null ? formatRp(skin.rp) : "—"}</span>
        </Row>
        <Row label="Prepaid code" note={target && target.plan.surplusRp > 0 ? `${formatRp(target.plan.surplusRp)} left over after the skin` : "Sent by the SKINFUND operator"}>
          {target ? <span className="num">{describePlan(target.plan)}</span> : pending}
        </Row>
        <Row label="Funding threshold">
          {target ? <span className="num">{formatMoney(target.threshold)}</span> : pending}
        </Row>
        <Row label="Funded value">{funded ? <span className="num">{formatMoney(funded)}</span> : pending}</Row>
        <Row label="Remaining">{p ? <span className="num">{formatMoney(p.remaining)}</span> : pending}</Row>
        {target && funded && target.threshold.currency !== "RP" && (
          <Row label="RP equivalent" note="Estimate: funded share of the code’s RP. Not RP you own.">
            <span className="num">≈ {formatRp(estimateRp(funded, target))}</span>
          </Row>
        )}
      </dl>
      {valuationBasis && <p className="mt-3 text-sm text-mist">Valuation basis: {valuationBasis}</p>}
    </div>
  );
}
