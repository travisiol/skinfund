"use client";

import { useRouter } from "next/navigation";
import { setApp, useApp } from "@/lib/store";
import { SkinSearch } from "../SkinSearch";

/** The homepage catalogue: picking a skin carries it into the setup flow. */
export function HomeCatalogue() {
  const app = useApp();
  const router = useRouter();
  return (
    <SkinSearch
      selectedId={app.skinId}
      onSelect={(skin) => {
        setApp({ skinId: skin.id, region: null });
        router.push("/start");
      }}
    />
  );
}
