import { FAQ } from "@/config/product";
import type { Rule } from "@/config/product";

export function RuleText({ rule }: { rule: Rule }) {
  if (rule.state === "confirmed") return <p>{rule.text}</p>;
  return (
    <p className="notice">
      <span className="chip chip-warn mr-2 align-middle">Not yet configured</span>
      This rule has not been set, so no answer is given rather than a guess. To decide: {rule.decide}
    </p>
  );
}

/** Answers come from the configured product rules. An unresolved rule is flagged, never invented. */
export function Faq() {
  return (
    <div className="border-t border-gold/70">
      {FAQ.map((item) => (
        <details key={item.q} className="group border-b border-gold/70">
          <summary className="flex min-h-16 list-none items-center justify-between gap-6 py-4 text-xl font-medium text-ivory transition-colors hover:text-teal [&::-webkit-details-marker]:hidden">
            {item.q}
            <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-gold transition-transform group-open:rotate-45" aria-hidden="true">
              <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="1.500" fill="none" />
            </svg>
          </summary>
          <div className="max-w-3xl space-y-3 pb-6 text-mist">
            {item.rules.map((rule, index) => (
              <RuleText key={index} rule={rule} />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
