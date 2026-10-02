// Dev helper: sign a sign-in message with a throwaway key, to test the wallet
// flow without a wallet extension.
//
//   node scripts/dev-sign.mjs new                 → prints a fresh { key, address }
//   node scripts/dev-sign.mjs <key> <message.txt> → prints the signature
//
// Never use a key that holds funds.

import { readFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const [first, file] = process.argv.slice(2);
if (first === "new") {
  const key = generatePrivateKey();
  console.log(JSON.stringify({ key, address: privateKeyToAccount(key).address }));
} else {
  const account = privateKeyToAccount(first);
  console.log(await account.signMessage({ message: readFileSync(file, "utf8") }));
}
