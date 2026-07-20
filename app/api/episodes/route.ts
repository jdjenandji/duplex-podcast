import { z } from "zod";
import { DEMO_URL, getDemoEpisode } from "@/lib/demo";
import { processEpisode, processEpisodeSelection } from "@/lib/pipeline";

export const maxDuration = 300;

const episodeSelectionSchema = z.object({
  sourceUrl: z.string().url().max(2_048),
  feedUrl: z.string().url().max(2_048),
  audioUrl: z.string().url().max(2_048),
  title: z.string().trim().min(1).max(500),
  duration: z.number().nonnegative().max(86_400),
  artworkUrl: z.string().url().max(2_048).optional(),
  officialTranscriptUrl: z.string().url().max(2_048).optional(),
  publishedAt: z.string().max(200).optional(),
});

const requestSchema = z.object({
  url: z.string().url().max(2_048).optional(),
  episode: episodeSelectionSchema.optional(),
  targetLanguage: z.string().trim().min(2).max(40).regex(/^[\p{L} -]+$/u).default("en"),
}).refine((input) => Boolean(input.url) !== Boolean(input.episode), {
  message: "Provide either a podcast URL or an episode selection.",
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    if (input.url === DEMO_URL) return Response.json(getDemoEpisode(input.targetLanguage));
    const episode = input.episode
      ? await processEpisodeSelection(input.episode, input.targetLanguage)
      : await processEpisode(input.url!, input.targetLanguage);
    return Response.json(episode);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The episode could not be prepared.";
    return Response.json({ error: message }, { status: cause instanceof z.ZodError ? 400 : 422 });
  }
}
