import Link from "next/link";
import { Logo } from "./Logo";
import { WalletButton } from "./WalletDialog";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#pot", label: "The pot" },
];

export function Header() {
  return (
    <header className="relative">
      <div className="shell flex h-[5.25rem] items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="absolute left-1/2 hidden -translate-x-1/2 gap-14 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="py-3 text-lg font-medium text-ivory transition-colors hover:text-teal">
              {item.label}
            </Link>
          ))}
        </nav>
        <WalletButton />
      </div>
      <div className="rule-gold" />
      <span aria-hidden="true" className="absolute bottom-0 left-1/2 size-[7px] -translate-x-1/2 translate-y-[3px] rotate-45 bg-gold" />
      <nav aria-label="Sections" className="shell flex gap-6 border-b py-1 md:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="py-2.5 text-[0.9375rem] font-medium text-mist">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
