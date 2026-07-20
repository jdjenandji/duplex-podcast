import { z } from "zod";
import { listFeedEpisodes } from "@/lib/pipeline";

const requestSchema = z.object({
  feedUrl: z.string().url().max(2_048),
});

export async function POST(request: Request) {
  try {
    const { feedUrl } = requestSchema.parse(await request.json());
    const episodes = await listFeedEpisodes(feedUrl);
    return Response.json({ episodes: episodes.slice(0, 30) });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The podcast episodes could not be loaded.";
    return Response.json({ error: message }, { status: cause instanceof z.ZodError ? 400 : 422 });
  }
}
