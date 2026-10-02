/**
 * Product rules — the single place they are written down.
 *
 * A rule is either CONFIRMED (text shown to players) or UNRESOLVED (shown as
 * "not yet configured", with a note for whoever has to decide it). Nothing in
 * the app invents a fee percentage, a formula or a minimum: fill them in here.
 */
export type Rule = { state: "confirmed"; text: string } | { state: "unresolved"; decide: string };

const confirmed = (text: string): Rule => ({ state: "confirmed", text });
// Kept for rules that get added before they are decided: the FAQ flags them instead of guessing.
export const unresolved = (decide: string): Rule => ({ state: "unresolved", decide });

export const RULES = {
  source: confirmed(
    "Rewards come only from actual trading fees on the token. A configured share of those fees goes to a reward pool, and the pool is what fills personal funds.",
  ),
  noVolume: confirmed(
    "No trading volume means no fees, and no fees means no rewards. Your fund simply does not move. Holding the token does not guarantee rewards or a completion date.",
  ),
  delivery: confirmed(
    "No. SKINFUND provides a prepaid RP code for your region. You redeem it in the League of Legends client yourself and buy the skin there. Nothing is delivered into a game account, and SKINFUND never asks for your Riot password.",
  ),
  affiliation: confirmed(
    "No. SKINFUND is not affiliated with or endorsed by Riot Games. League of Legends and Riot Games are trademarks of Riot Games, Inc.",
  ),
  atTarget: confirmed(
    "You can claim. The server re-checks eligibility, your funded balance, the region and the available code denomination, and reserves your fund. Codes are bought and sent by the SKINFUND operator by hand, so the claim shows as pending until your code is entered — there is no instant delivery. Each fund can be claimed once; the code is shown only to you and can be re-opened later from your fund page.",
  ),
  denominations: confirmed(
    "Your fund is counted in RP and its target is the skin's listed RP price. The SKINFUND operator buys the prepaid card(s) that cover it; cards come in fixed sizes, so your code can carry slightly more RP than the skin costs, and the extra stays on your account.",
  ),
  progressMeaning: confirmed(
    "The progress bar is RP recorded toward a prepaid code. It is not RP on your League account and not ownership of a partially unlocked skin: you hold RP only once a code is issued and redeemed.",
  ),

  allocation: confirmed(
    "There is no automatic formula yet. At each distribution the SKINFUND operator records each holder's share in RP, by hand, and every entry is listed in your reward history with its reference — so you can always check what you received and why.",
  ),
  minimumHolding: confirmed(
    "The site itself enforces no minimum holding. Rewards go to the wallets credited at each distribution, and a wallet that has received nothing simply shows an empty fund.",
  ),
  sellOrTransfer: confirmed(
    "RP already recorded in your fund stays in your fund: nothing is taken back if you sell or transfer. Your fund is tied to your wallet address, so it does not move with the tokens, and later distributions are decided at the time they happen.",
  ),
  targetChange: confirmed(
    "Yes. Your recorded RP belongs to your wallet, not to a skin, so you can pick another skin or region at any time and keep your progress — except while a claim is pending. After a completed claim, picking a new target starts a new fund.",
  ),
  regions: confirmed(
    "The regions offered are the ones the SKINFUND operator can currently supply codes for; the setup flow lists them, and the list can change. A code only redeems on an account from its own region — codes are not interchangeable between servers.",
  ),
  rewardRecording: confirmed(
    "Each time trading fees are distributed, the SKINFUND operator records your share in RP. Every entry appears in your reward history with its reference. Nothing is estimated in between.",
  ),
} satisfies Record<string, Rule>;

export const FAQ: { q: string; rules: Rule[] }[] = [
  { q: "How do trading fees fund rewards?", rules: [RULES.source, RULES.rewardRecording] },
  { q: "What happens when there is no volume?", rules: [RULES.noVolume] },
  { q: "How is my reward share calculated?", rules: [RULES.allocation, RULES.minimumHolding] },
  { q: "What if I sell or transfer tokens?", rules: [RULES.sellOrTransfer] },
  { q: "Which redemption regions are supported?", rules: [RULES.regions, RULES.denominations] },
  { q: "What happens when my fund reaches the target?", rules: [RULES.atTarget] },
  { q: "Can I change my target?", rules: [RULES.targetChange] },
  { q: "Does SKINFUND deliver a skin directly?", rules: [RULES.delivery] },
  { q: "Is SKINFUND affiliated with Riot Games?", rules: [RULES.affiliation] },
];
