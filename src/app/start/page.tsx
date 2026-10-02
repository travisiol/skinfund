import type { Metadata } from "next";
import { SetupFlow } from "@/components/app/SetupFlow";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata: Metadata = { title: "Start my skin fund" };

export default function StartPage() {
  return (
    <>
      <Header />
      <main id="main" className="shell pt-10 pb-24">
        <div className="mb-8">
          <p className="eyebrow mb-2">Setup</p>
          <h1 className="display text-4xl md:text-5xl">Start my skin fund</h1>
        </div>
        <SetupFlow />
      </main>
      <Footer />
    </>
  );
}
