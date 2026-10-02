import { allSkins, CATALOGUE_META } from "@/integrations/catalogue";

// The snapshot only changes when `npm run catalogue` is run, so this is built once.
export const dynamic = "force-static";

export function GET() {
  return Response.json({ meta: CATALOGUE_META, skins: allSkins() });
}
