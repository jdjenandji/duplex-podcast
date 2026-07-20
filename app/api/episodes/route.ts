import { z } from "zod";
import { DEMO_URL, getDemoEpisode } from "@/lib/demo";
import { processEpisode } from "@/lib/pipeline";

export const maxDuration = 300;

const requestSchema = z.object({
  url: z.string().url().max(2_048),
  targetLanguage: z.string().trim().min(2).max(40).regex(/^[\p{L} -]+$/u).default("en"),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    if (input.url === DEMO_URL) return Response.json(getDemoEpisode(input.targetLanguage));
    const episode = await processEpisode(input.url, input.targetLanguage);
    return Response.json(episode);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The episode could not be prepared.";
    return Response.json({ error: message }, { status: cause instanceof z.ZodError ? 400 : 422 });
  }
}
