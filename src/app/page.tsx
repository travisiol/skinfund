import Link from "next/link";
import type { CSSProperties } from "react";
import { AngularLink } from "@/components/AngularButton";
import { Faq, RuleText } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { FundSummary } from "@/components/FundSummary";
import { Header } from "@/components/Header";
import { HomeCatalogue } from "@/components/home/HomeCatalogue";
import { Pot } from "@/components/Pot";
import { ProgressGauge } from "@/components/ProgressGauge";
import { SkinCard } from "@/components/SkinCard";
import { RULES } from "@/config/product";
import { fundingTarget, planFor } from "@/core/funding";
import { HERO_SKIN_ID, skinById } from "@/integrations/catalogue";
import { formatRp } from "@/lib/format";

// Illustrative homepage values. They describe an example fund, not anyone's rewards.
const EXAMPLE = { ratio: 0.72, region: "EUW", regionLabel: "EU West", today: "+18 RP today" };

const STEPS = ["Pick your skin", "Hold the coin", "Get your RP code"];

const FLOW = [
  { title: "Trading fees", text: "Collected only when the token actually trades." },
  { title: "Reward pool", text: "A configured share of those fees is set aside for holders." },
  { title: "Your personal fund", text: "Your eligible share of the pool accrues toward your target." },
  { title: "Prepaid RP code", text: "At the threshold you claim a code for your region." },
];

function SectionTitle({ id, eyebrow, children }: { id: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h2 id={id} className="display text-[2.25rem] md:text-5xl">
        {children}
      </h2>
    </div>
  );
}

export default function Home() {
  const skin = skinById(HERO_SKIN_ID);
  if (!skin || skin.rp === null) throw new Error("The homepage skin is missing from the catalogue snapshot. Run `npm run catalogue`.");
  const plan = planFor(skin.rp, { denominations: [], exact: true });
  const target = plan ? fundingTarget(plan, []) : null;
  const funded = target ? { minor: Math.floor(target.threshold.minor * EXAMPLE.ratio), currency: target.threshold.currency } : null;

  return (
    <>
      <Header />
      <main id="main">
        {/* ───────────── Hero */}
        <section className="shell grid items-center gap-x-10 gap-y-14 pt-12 pb-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:pt-10 lg:pb-12">
          <div>
            <h1 className="display text-[min(2.875rem,10.4vw)] leading-[1.1] md:text-[3.75rem] xl:text-[4.875rem] xl:leading-[5.25rem] xl:tracking-[-1.6px]">
              <span className="block">Hold the coin.</span>
              <span className="block">It buys</span>
              <span className="block text-teal">your skin.</span>
            </h1>
            <p className="mt-6 text-xl leading-8 text-mist xl:text-[1.375rem]">
              <span className="sm:block">Trading fees fill your fund. </span>
              <span className="sm:block">When it&apos;s full, you get the RP code.</span>
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-5">
              <AngularLink href="/start" size="lg">
                Start my skin fund
              </AngularLink>
              <Link href="#how" className="link text-xl">
                See how it works
              </Link>
            </div>
            <p className="mt-7 text-[0.9375rem] text-mist">Funded by trading fees. No volume, no rewards.</p>
          </div>

          <div className="relative mx-auto w-fit pb-2 xl:mr-[15.5rem]" aria-label="Example of a skin fund at 72%">
            <div className="rise flex rotate-[4deg] items-stretch gap-5 px-3 sm:gap-6">
              <ProgressGauge orientation="vertical" percent={EXAMPLE.ratio * 100} label="Example funding progress" className="my-12" />
              <div>
                <SkinCard skin={skin} ratio={EXAMPLE.ratio} className="w-[min(62vw,250px)] sm:w-[330px]" />
                <p className="mt-4 text-center">
                  <span className="ticket frame text-xl">{formatRp(skin.rp)}</span>
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3 xl:contents">
              <span className="ticket frame xl:absolute xl:top-[13%] xl:left-[calc(100%+1.25rem)] xl:w-[13.5rem] xl:-rotate-[9deg] xl:py-3 xl:text-center xl:text-lg xl:whitespace-normal">
                RP CODE · {EXAMPLE.region} · LOCKED
              </span>
              <span className="ticket frame xl:absolute xl:top-[66%] xl:left-[calc(100%+0.5rem)] xl:rotate-[5deg] xl:px-8 xl:py-4 xl:text-xl">
                {EXAMPLE.today}
              </span>
            </div>
            <p className="mt-6 text-center xl:mt-4">
              <span className="chip">Preview · example values, not live rewards</span>
            </p>
          </div>
        </section>

        {/* ───────────── Three steps */}
        <section aria-label="Three steps" className="shell">
          <ol className="grid border-y border-gold/80 md:grid-cols-3">
            {STEPS.map((label, index) => (
              <li
                key={label}
                className="flex items-center justify-center gap-5 border-gold/60 px-3 lg:gap-10 py-5 max-md:justify-start max-md:border-b max-md:last:border-b-0 md:my-5 md:border-l md:py-3 md:first:border-l-0"
              >
                <span className="num text-[1.75rem] leading-none text-teal lg:text-[2.125rem]">0{index + 1}</span>
                <span className="text-xl font-medium text-ivory lg:text-2xl">{label}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ───────────── 1. Your bag. Your skin. */}
        <section aria-labelledby="bag" className="shell pt-7">
          <div className="frame px-6 py-12 sm:px-13 md:py-16" style={{ "--c": "30px", "--bw": "2px" } as CSSProperties}>
            <h2 id="bag" className="display text-[2.5rem] md:text-6xl xl:text-[4.5rem]">
              Your bag. Your skin.
            </h2>
            <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-20">
              <div>
                <ul className="max-w-xl space-y-5 text-xl text-mist">
                  <li>
                    <span className="font-semibold text-ivory">Pick your target.</span> One skin, one redemption region.
                  </li>
                  <li>
                    <span className="font-semibold text-ivory">Eligible trading fees contribute to your fund.</span> It only moves when the token
                    actually trades.
                  </li>
                  <li>
                    <span className="font-semibold text-ivory">Claim an RP code</span> once the required funding threshold is reached, and buy the
                    skin yourself in League of Legends.
                  </li>
                </ul>
                <AngularLink href="/start" className="mt-10">
                  Start my skin fund
                </AngularLink>
              </div>
              <div className="border border-gold/60 bg-night p-5 sm:p-7">
                <FundSummary skin={skin} regionLabel={EXAMPLE.regionLabel} target={target} funded={funded} tag="Example" />
              </div>
            </div>
          </div>
        </section>

        {/* ───────────── 2. Catalogue */}
        <section aria-labelledby="catalogue" className="shell pt-24">
          <SectionTitle id="catalogue" eyebrow="Skin catalogue">
            Pick your next unlock.
          </SectionTitle>
          <HomeCatalogue />
        </section>

        {/* ───────────── 3. How the fund fills */}
        <section aria-labelledby="how" className="shell pt-24">
          <SectionTitle id="how" eyebrow="The mechanism">
            How the fund fills
          </SectionTitle>
          <ol className="grid gap-px border border-gold/70 bg-gold/70 md:grid-cols-2 xl:grid-cols-4">
            {FLOW.map((step, index) => (
              <li key={step.title} className="relative bg-night p-6 sm:p-8">
                <span className="num text-teal">0{index + 1}</span>
                <h3 className="mt-3 text-2xl font-semibold text-ivory">{step.title}</h3>
                <p className="mt-2 text-mist">{step.text}</p>
                {index < FLOW.length - 1 && (
                  <span aria-hidden="true" className="num absolute top-6 right-6 text-xl text-gold max-md:hidden sm:top-8 sm:right-8">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-20">
            <div className="space-y-4 text-lg text-mist">
              <RuleText rule={RULES.source} />
              <RuleText rule={RULES.noVolume} />
              <RuleText rule={RULES.progressMeaning} />
            </div>
            <div className="space-y-4 text-lg text-mist">
              <RuleText rule={RULES.rewardRecording} />
              <RuleText rule={RULES.allocation} />
              <RuleText rule={RULES.denominations} />
            </div>
          </div>
        </section>

        {/* ───────────── 4. The pot */}
        <section aria-labelledby="pot" className="shell pt-24">
          <SectionTitle id="pot" eyebrow="Pool data">
            The pot
          </SectionTitle>
          <Pot />
        </section>

        {/* ───────────── 5. FAQ */}
        <section aria-labelledby="faq" className="shell pt-24 pb-24">
          <SectionTitle id="faq" eyebrow="Questions">
            FAQ
          </SectionTitle>
          <Faq />
        </section>
      </main>
      <Footer />
    </>
  );
}
