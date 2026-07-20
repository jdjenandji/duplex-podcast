import { z } from "zod";
import { searchPodcasts } from "@/lib/podcast-discovery";

const querySchema = z.string().trim().min(2).max(120);

export async function GET(request: Request) {
  try {
    const query = querySchema.parse(new URL(request.url).searchParams.get("q"));
    return Response.json({ podcasts: await searchPodcasts(query) });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Podcast search failed.";
    return Response.json({ error: message }, { status: cause instanceof z.ZodError ? 400 : 422 });
  }
}
