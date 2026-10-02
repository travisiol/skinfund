import Link from "next/link";

/** An angular card whose lower part is filled: the fund, part-way there. */
export function Mark({ className = "size-11" }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" className={className} aria-hidden="true">
      <path d="M22 2.5 38.5 12v20L22 41.5 5.500 32V12z" fill="none" stroke="#B39A64" strokeWidth="2.2" strokeLinejoin="miter" />
      <path d="M13 17.500 22 12.300l9 5.200v9.800L22 32.500l-9-5.200z" fill="#091821" stroke="#EDE8DC" strokeWidth="1.800" />
      <path d="M13 24.500 31 16.500v10.800L22 32.500l-9-5.200z" fill="#58D9CB" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="skinfund — home">
      <Mark />
      <span className="text-[1.75rem] leading-none font-semibold tracking-[-0.01em] text-ivory">skinfund</span>
    </Link>
  );
}
