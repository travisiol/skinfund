/** An integration is either wired to a real adapter, or it names what is missing. */
export type Integration<T> = { ready: true; adapter: T } | { ready: false; needs: string };

export const missing = (needs: string): { ready: false; needs: string } => ({ ready: false, needs });
