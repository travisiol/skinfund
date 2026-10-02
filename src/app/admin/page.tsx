import type { Metadata } from "next";
import { AdminPanel } from "@/components/app/AdminPanel";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Operator", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <>
      <header className="border-b border-gold/70">
        <div className="shell flex h-[5.25rem] items-center justify-between">
          <Logo />
          <span className="eyebrow">Operator panel</span>
        </div>
      </header>
      <main id="main" className="shell pt-10 pb-24">
        <h1 className="display mb-8 text-4xl md:text-5xl">Operator</h1>
        <AdminPanel />
      </main>
    </>
  );
}
