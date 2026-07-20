import { listCachedEpisodes } from "@/lib/pipeline";

export async function GET() {
  try {
    return Response.json({ episodes: await listCachedEpisodes(6) });
  } catch {
    // Cached examples are optional and should never block the entry screen.
    return Response.json({ episodes: [] });
  }
}
