import { SITE } from "@/config/site";
import { Mark } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gold/70">
      <div className="shell grid gap-8 py-12 md:grid-cols-[auto_1fr] md:gap-16">
        <div className="flex items-center gap-3 self-start">
          <Mark className="size-9" />
          <span className="text-2xl leading-none font-semibold text-ivory">skinfund</span>
        </div>
        <div className="max-w-3xl space-y-3 text-[0.9375rem] text-mist">
          <p className="text-base font-medium text-ivory">{SITE.disclaimer}</p>
          <p>
            SKINFUND isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing
            or managing Riot Games properties. Riot Games, League of Legends and all associated properties are trademarks or registered trademarks
            of Riot Games, Inc.
          </p>
          <p>
            Rewards depend on actual trading fees: no volume, no rewards, and no guaranteed amount or date. Owning the token involves market risk —
            its value can fall, including to zero. SKINFUND provides prepaid RP codes, not skins, and never asks for your Riot password.
          </p>
        </div>
      </div>
    </footer>
  );
}
