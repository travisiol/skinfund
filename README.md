# skinfund

A token for League of Legends players: a share of actual trading fees fills a personal fund toward a prepaid RP code.
Not affiliated with or endorsed by Riot Games.

```
npm run dev        # http://localhost:3743
npm test           # funding maths, catalogue search, claim ledger
npm run catalogue  # refresh src/data/catalogue.json (Data Dragon names + Meraki prices)
```

## How it runs today: by hand

The operator (you) runs the money side from `/admin` (password = `ADMIN_SECRET`):

1. **Record a reward** — when you distribute trading fees, enter each holder's share in RP. It lands in their fund and their history.
2. **Codes to send** — when a full fund is claimed it appears here; buy the card(s), paste the code(s), and the holder sees them on their fund page.
3. **Regions** — the standard League servers are open from the first run; hide the ones you cannot buy cards for.

A fund is counted in RP and is full when it reaches the skin's listed RP price.

Holders connect a wallet, sign a message (no gas), pick a skin and a region, and watch their fund. There is no demo mode: everything shown is real.

| Part | State |
| --- | --- |
| Skin catalogue (names, RP prices, availability) | Real — dated snapshot, 1,825 skins |
| Wallet connection, wallet sign-in | Real (EIP-6963 + signed message; app deep links and install links when no wallet is present) |
| Regions, rewards, code delivery | Real, run by the operator in `/admin` |
| Skin artwork | On by default, hot-linked from Data Dragon; `NEXT_PUBLIC_SKIN_ART=off` disables it. Not cleared with Riot |
| Token balances, automatic fee accounting ("The pot") | Need the chain + token address |

`node scripts/verify-api.mjs` replays the whole loop over HTTP with throwaway wallets (run it against a scratch `SKINFUND_DATA_DIR`).

## Where things live

- `src/config/product.ts` — product rules. Unresolved ones are flagged in the UI until filled in.
- `src/core/` — framework-free logic: `funding.ts` (denomination plan, threshold, progress), `ledger.ts` (funds, claims), `manual.ts` (the operator's book: regions, RP rewards), `ports.ts` (integration interfaces).
- `src/integrations/` — one file per integration. Return a real adapter from each to go live.
- `src/app/api/claim` — the only route that carries an RP code: session-only, `no-store`, codes encrypted at rest.
