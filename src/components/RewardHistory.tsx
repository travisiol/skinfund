import type { RewardEntry } from "@/core/types";
import { formatDate, formatMoney } from "@/lib/format";

/** Rewards actually allocated to this fund. `entries` null means there is no reward source to read. */
export function RewardHistory({ entries, tag }: { entries: RewardEntry[] | null; tag?: string }) {
  return (
    <section aria-labelledby="history-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="history-title" className="eyebrow">
          Reward history
        </h2>
        {tag && <span className="chip chip-teal">{tag}</span>}
      </div>
      {entries === null ? (
        <p className="notice">No reward data. The reward-allocation source is not configured, so there is nothing to show — and nothing is estimated.</p>
      ) : entries.length === 0 ? (
        <p className="notice">No rewards yet. Rewards only appear after trading fees are actually collected and distributed.</p>
      ) : (
        <ul className="border-t">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-6 border-b py-3">
              <span>
                <span className="text-ivory">{formatDate(entry.at)}</span>
                <span className="block text-sm text-mist">{entry.reference}</span>
              </span>
              <span className="num text-teal">+{formatMoney(entry.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
