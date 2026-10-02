import type { CSSProperties } from "react";
import { skinArt } from "@/config/site";
import type { Skin } from "@/core/types";
import { Mark } from "./Logo";

/**
 * The tall skin card: gold angular frame, artwork cut to the same shape, and
 * a name plate. `ratio` (0–1) reveals the artwork from the bottom up to show
 * funding progress; the part above the teal line stays darkened. With no
 * ratio the artwork is shown plainly.
 *
 * Artwork only loads when the asset source is enabled (see src/config/site.ts).
 * Otherwise the card says so — it never substitutes another image.
 */
export function SkinCard({
  skin,
  ratio = null,
  pulse = false,
  className = "",
}: {
  skin: Skin;
  ratio?: number | null;
  /** Play the single unlock pulse. Only set when a fund is actually full. */
  pulse?: boolean;
  className?: string;
}) {
  const art = skinArt(skin, "wide");
  const hidden = ratio === null ? 0 : (1 - Math.max(0, Math.min(1, ratio))) * 100;

  return (
    <figure
      className={`frame relative aspect-[33/50] ${pulse ? "unlock-pulse" : ""} ${className}`}
      style={{ "--c": "24px", "--bw": "2px", "--fill": "var(--color-night)" } as CSSProperties}
    >
      <div className="cut absolute inset-[7px] overflow-hidden bg-surface" style={{ "--c": "19px" } as CSSProperties}>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element -- hot-linked from the asset CDN, not re-hosted or optimised
          <img
            src={art}
            alt={`${skin.name} splash art`}
            className="absolute top-0 left-1/2 h-[132%] w-auto max-w-none -translate-x-[47%]"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(160deg,#1a3344_0%,#122331_55%,#0c1c27_100%)] px-6 text-center">
            <div>
              <Mark className="mx-auto size-16 opacity-80" />
              <p className="eyebrow mt-4">Artwork not enabled</p>
              <p className="mt-1 text-sm text-mist">Official splash art loads once asset use is cleared.</p>
            </div>
          </div>
        )}
        {ratio !== null && hidden > 0 && (
          <>
            <div
              aria-hidden="true"
              className="reveal-fill absolute inset-x-0 top-0 bg-night/55"
              style={{ height: `${hidden}%`, backdropFilter: "grayscale(0.85)" }}
            />
            <div
              aria-hidden="true"
              className="reveal-line absolute inset-x-0 h-[2px] bg-teal shadow-[0_0_10px_rgba(88,217,203,0.55)]"
              style={{ top: `${hidden}%` }}
            />
          </>
        )}
      </div>
      <figcaption className="absolute inset-x-[7px] bottom-[7px]">
        <div
          className="frame mx-2 mb-2 px-3 py-3 text-center"
          style={{ "--c": "12px", "--fill": "color-mix(in srgb, var(--color-night) 92%, transparent)" } as CSSProperties}
        >
          <span className="display block text-[1.375rem] leading-tight tracking-normal">{skin.name}</span>
        </div>
      </figcaption>
    </figure>
  );
}
