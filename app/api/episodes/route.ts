import { z } from "zod";
import { DEMO_URL, getDemoEpisode } from "@/lib/demo";
import {
  processEpisode,
  processEpisodeSelection,
  type ProcessingProgress,
} from "@/lib/pipeline";
import type { EpisodePayload } from "@/lib/types";

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
    const prepareEpisode = (onProgress?: (update: ProcessingProgress) => void) => {
      if (input.url === DEMO_URL) return Promise.resolve(getDemoEpisode(input.targetLanguage));
      return input.episode
        ? processEpisodeSelection(input.episode, input.targetLanguage, onProgress)
        : processEpisode(input.url!, input.targetLanguage, onProgress);
    };

    if (!request.headers.get("accept")?.includes("application/x-ndjson")) {
      return Response.json(await prepareEpisode());
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (value: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
        };
        const report = (progress: ProcessingProgress) => send({ type: "progress", ...progress });

        void prepareEpisode(report)
          .then((episode: EpisodePayload) => send({ type: "result", episode }))
          .catch((cause: unknown) => send({
            type: "error",
            error: cause instanceof Error ? cause.message : "The episode could not be prepared.",
          }))
          .finally(() => controller.close());
      },
    });

    return new Response(stream, {
      headers: {
        "cache-control": "no-cache, no-transform",
        "content-type": "application/x-ndjson; charset=utf-8",
        "x-accel-buffering": "no",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The episode could not be prepared.";
    return Response.json({ error: message }, { status: cause instanceof z.ZodError ? 400 : 422 });
  }
}
