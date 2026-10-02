import "server-only";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ledger } from "@/core/ledger";
import { ManualBook } from "@/core/manual";

/**
 * `./data` when the disk is writable; otherwise the OS temp directory, which
 * is EPHEMERAL on serverless hosts. Claims must not run on ephemeral storage,
 * so `persistent` is checked before a claim is accepted.
 */
function resolveDataDir(): { dir: string; persistent: boolean } {
  const explicit = process.env.SKINFUND_DATA_DIR;
  try {
    const dir = explicit || join(process.cwd(), "data");
    mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
    accessSync(/* turbopackIgnore: true */ dir, constants.W_OK);
    return { dir, persistent: true };
  } catch {
    const dir = join(tmpdir(), "skinfund");
    mkdirSync(dir, { recursive: true });
    console.warn("[skinfund] data directory is not writable; using ephemeral temp storage");
    return { dir, persistent: false };
  }
}

/** A secret from the environment, or — in development only — one generated once and kept in ./data. */
export function secretFor(envName: string, devFile: string, dataDir: string): string | null {
  const fromEnv = process.env[envName];
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production") return null;
  const file = join(dataDir, devFile);
  if (existsSync(file)) return readFileSync(file, "utf8");
  const generated = randomBytes(32).toString("hex");
  writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

interface Runtime {
  ledger: Ledger;
  /** The operator's record of regions, cards and distributed rewards. */
  book: ManualBook;
  dataDir: string;
  persistent: boolean;
  /** False in production without CLAIM_SECRET: codes could not be stored safely. */
  claimsSealed: boolean;
}

const globalRuntime = globalThis as unknown as { __skinfund?: Runtime };

export function runtime(): Runtime {
  if (!globalRuntime.__skinfund) {
    const { dir, persistent } = resolveDataDir();
    const db = new DatabaseSync(join(dir, "skinfund.db"));
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA busy_timeout = 5000");
    const codeSecret = secretFor("CLAIM_SECRET", ".dev-claim-secret", dir);
    globalRuntime.__skinfund = {
      book: new ManualBook(db),
      // Without a secret the ledger still serves funds and nonces; claims are refused upstream.
      ledger: new Ledger(db, { codeSecret: codeSecret ?? randomBytes(32).toString("hex") }),
      dataDir: dir,
      persistent,
      claimsSealed: codeSecret !== null,
    };
  }
  return globalRuntime.__skinfund;
}

export function ledger(): Ledger {
  return runtime().ledger;
}

export function book(): ManualBook {
  return runtime().book;
}
