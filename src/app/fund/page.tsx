import type { Metadata } from "next";
import { FundDashboard } from "@/components/app/FundDashboard";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata: Metadata = { title: "My skin fund" };

export default function FundPage() {
  return (
    <>
      <Header />
      <main id="main" className="shell pt-10 pb-24">
        <div className="mb-10">
          <p className="eyebrow mb-2">Personal fund</p>
          <h1 className="display text-4xl md:text-5xl">My skin fund</h1>
        </div>
        <FundDashboard />
      </main>
      <Footer />
    </>
  );
}
