import { XMLParser } from "fast-xml-parser";
import type { EpisodePayload, TranscriptSegment } from "./types";

type RawSegment = Omit<TranscriptSegment, "id" | "translatedText">;
type ResolvedEpisode = {
  sourceUrl: string;
  feedUrl: string;
  audioUrl: string;
  title: string;
  duration: number;
  artworkUrl?: string;
  officialTranscriptUrl?: string;
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
const MEBIBYTE = 1024 * 1024;
export const TRANSCRIPTION_CHUNK_BYTES = 20 * MEBIBYTE;

export function firstAudioChunkEnd(
  audioSize: number,
  chunkSize = TRANSCRIPTION_CHUNK_BYTES,
): number {
  if (!Number.isFinite(audioSize) || audioSize < 0 || !Number.isFinite(chunkSize) || chunkSize <= 0) {
    throw new Error("The episode audio size could not be processed.");
  }
  return Math.min(audioSize, chunkSize);
}

function list<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function secondsFromDuration(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const parts = value.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: { "user-agent": "Duplex/0.1 podcast language player" } });
  if (!response.ok) throw new Error(`The podcast server returned ${response.status}.`);
  return { text: await response.text(), contentType: response.headers.get("content-type") ?? "" };
}

export async function resolveEpisode(sourceUrl: string): Promise<ResolvedEpisode> {
  const directAudio = /\.(mp3|m4a|aac|ogg|wav)(\?|$)/i.test(sourceUrl);
  if (directAudio) {
    return { sourceUrl, feedUrl: sourceUrl, audioUrl: sourceUrl, title: "Podcast episode", duration: 0 };
  }

  let feedUrl = sourceUrl;
  let fetched = await fetchText(feedUrl);
  if (!/(rss|xml|atom)/i.test(fetched.contentType) && !/^\s*</.test(fetched.text)) {
    throw new Error("This does not look like a podcast feed or episode URL.");
  }
  if (!/<(rss|feed)\b/i.test(fetched.text)) {
    const alternate = fetched.text.match(/<link[^>]+type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)/i)
      ?? fetched.text.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss\+xml|atom\+xml)/i);
    if (!alternate) throw new Error("No podcast RSS feed was found at this URL.");
    feedUrl = new URL(alternate[1], sourceUrl).toString();
    fetched = await fetchText(feedUrl);
  }

  const document = parser.parse(fetched.text);
  const channel = document?.rss?.channel ?? document?.feed;
  const items = list(channel?.item ?? channel?.entry);
  const item = items.find((candidate: Record<string, unknown>) => candidate.enclosure || candidate["media:content"]) ?? items[0];
  if (!item) throw new Error("This feed does not contain a podcast episode.");

  const enclosure = item.enclosure ?? item["media:content"];
  const audioUrl = enclosure?.["@_url"] ?? enclosure?.["@_href"] ?? enclosure?.url;
  if (!audioUrl) throw new Error("No playable audio was found in this episode.");
  const transcript = list(item["podcast:transcript"])[0];
  const image = item["itunes:image"]?.["@_href"] ?? channel?.["itunes:image"]?.["@_href"] ?? channel?.image?.url;
  return {
    sourceUrl,
    feedUrl,
    audioUrl: new URL(String(audioUrl), feedUrl).toString(),
    title: String(item.title?.["#text"] ?? item.title ?? channel?.title ?? "Podcast episode"),
    duration: secondsFromDuration(item["itunes:duration"]),
    artworkUrl: image ? String(image) : undefined,
    officialTranscriptUrl: transcript?.["@_url"] ? new URL(String(transcript["@_url"]), feedUrl).toString() : undefined,
  };
}

function parseTimestamp(value: string) {
  const parts = value.replace(",", ".").split(":").map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function parseTimedText(text: string): RawSegment[] {
  const blocks = text.replace(/^WEBVTT[^\n]*\n/i, "").split(/\n\s*\n/);
  const segments: RawSegment[] = [];
  for (const block of blocks) {
    const lines = block.trim().split(/\r?\n/);
    const timingIndex = lines.findIndex((line) => line.includes(" --> "));
    if (timingIndex < 0) continue;
    const [start, end] = lines[timingIndex].split(" --> ");
    const originalText = lines.slice(timingIndex + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (originalText) segments.push({ startTime: parseTimestamp(start), endTime: parseTimestamp(end.split(/\s/)[0]), originalText });
  }
  return segments;
}

async function getOfficialTranscript(url: string): Promise<RawSegment[]> {
  const { text, contentType } = await fetchText(url);
  if (/json/i.test(contentType) || /^\s*[\[{]/.test(text)) {
    const data = JSON.parse(text);
    const entries = data.segments ?? data.cues ?? data;
    if (Array.isArray(entries)) {
      return entries.map((entry) => ({
        startTime: Number(entry.startTime ?? entry.start ?? 0),
        endTime: Number(entry.endTime ?? entry.end ?? 0),
        originalText: String(entry.body ?? entry.text ?? entry.transcript ?? "").trim(),
      })).filter((entry) => entry.originalText && entry.endTime > entry.startTime);
    }
  }
  return parseTimedText(text);
}

async function transcribeAudio(audioUrl: string): Promise<{ language: string; segments: RawSegment[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No official transcript was found. Add OPENAI_API_KEY to generate one.");
  const audioResponse = await fetch(audioUrl, {
    headers: { range: `bytes=0-${TRANSCRIPTION_CHUNK_BYTES - 1}` },
  });
  if (!audioResponse.ok) throw new Error("The episode audio could not be downloaded for transcription.");
  const audio = await audioResponse.blob();
  const firstChunk = audio.slice(0, firstAudioChunkEnd(audio.size), audio.type);
  const form = new FormData();
  form.set("file", new File([firstChunk], "episode-opening.mp3", { type: audio.type || "audio/mpeg" }));
  form.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1");
  form.set("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) throw new Error(`Transcription failed (${response.status}).`);
  const body = await response.json() as { language?: string; segments?: Array<{ start: number; end: number; text: string }> };
  const segments = (body.segments ?? []).map((segment) => ({
    startTime: segment.start,
    endTime: segment.end,
    originalText: segment.text.trim(),
  })).filter((segment) => segment.originalText);
  return { language: body.language || "und", segments };
}

async function translateSegments(segments: RawSegment[], targetLanguage: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required to translate this transcript.");
  const translations: string[] = [];
  for (let offset = 0; offset < segments.length; offset += 40) {
    const batch = segments.slice(offset, offset + 40);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-5.4-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Translate every numbered sentence literally into ${targetLanguage}. Preserve wording and grammar structure when possible. Return only JSON: {\"translations\":[\"...\"]}. Return exactly the same number and order.` },
          { role: "user", content: batch.map((segment, index) => `${index + 1}. ${segment.originalText}`).join("\n") },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Translation failed (${response.status}).`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as { translations?: string[] };
    if (parsed.translations?.length !== batch.length) throw new Error("The translation provider returned an incomplete result.");
    translations.push(...parsed.translations);
  }
  return translations;
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

async function supabaseRequest(path: string, init?: RequestInit) {
  const config = supabaseConfig();
  if (!config) return null;
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Transcript cache failed (${response.status}).`);
  return response;
}

export async function getCachedEpisode(sourceUrl: string, targetLanguage: string): Promise<EpisodePayload | null> {
  if (!supabaseConfig()) return null;
  const episodeResponse = await supabaseRequest(`episodes?source_url=eq.${encodeURIComponent(sourceUrl)}&select=*&limit=1`);
  const episodes = await episodeResponse!.json() as Array<Record<string, unknown>>;
  const episode = episodes[0];
  if (!episode) return null;
  const segmentsResponse = await supabaseRequest(`transcript_segments?episode_id=eq.${episode.id}&select=*,translations(*)&translations.target_language=eq.${encodeURIComponent(targetLanguage)}&order=sentence_number.asc`);
  const rows = await segmentsResponse!.json() as Array<Record<string, unknown> & {
    translations?: Array<{ translated_text?: unknown }>;
  }>;
  if (!rows.length || rows.some((row) => !row.translations?.[0])) return null;
  return {
    id: String(episode.id), sourceUrl, audioUrl: String(episode.audio_url), title: String(episode.title),
    duration: Number(episode.duration_seconds || 0), sourceLanguage: String(episode.source_language || "und"),
    targetLanguage, artworkUrl: episode.artwork_url ? String(episode.artwork_url) : undefined,
    cached: true, transcriptSource: episode.transcript_source === "official" ? "official" : "generated",
    segments: rows.map((row) => ({ id: String(row.id), startTime: Number(row.start_time_ms) / 1000,
      endTime: Number(row.end_time_ms) / 1000, originalText: String(row.original_text),
      translatedText: String(row.translations?.[0]?.translated_text ?? "") })),
  };
}

async function cacheEpisode(payload: EpisodePayload, feedUrl: string) {
  if (!supabaseConfig()) return;
  await supabaseRequest("episodes?on_conflict=source_url", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({
    id: payload.id, source_url: payload.sourceUrl, feed_url: feedUrl, title: payload.title, audio_url: payload.audioUrl,
    duration_seconds: payload.duration, source_language: payload.sourceLanguage, artwork_url: payload.artworkUrl ?? null,
    transcript_source: payload.transcriptSource,
  }) });
  const rows = payload.segments.map((segment, index) => ({ episode_id: payload.id, sentence_number: index,
    start_time_ms: Math.round(segment.startTime * 1000), end_time_ms: Math.round(segment.endTime * 1000), original_text: segment.originalText }));
  const segmentResponse = await supabaseRequest("transcript_segments?on_conflict=episode_id,sentence_number", { method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(rows) });
  const stored = await segmentResponse!.json() as Array<{ id: number; sentence_number: number }>;
  const translations = stored.map((row) => ({ transcript_segment_id: row.id, target_language: payload.targetLanguage,
    translated_text: payload.segments[row.sentence_number].translatedText }));
  await supabaseRequest("translations?on_conflict=transcript_segment_id,target_language", { method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(translations) });
}

export async function processEpisode(sourceUrl: string, targetLanguage: string): Promise<EpisodePayload> {
  const cached = await getCachedEpisode(sourceUrl, targetLanguage);
  if (cached) return cached;
  const resolved = await resolveEpisode(sourceUrl);
  let segments: RawSegment[] = [];
  let sourceLanguage = "und";
  let transcriptSource: "official" | "generated" = "generated";
  if (resolved.officialTranscriptUrl) {
    segments = await getOfficialTranscript(resolved.officialTranscriptUrl);
    transcriptSource = "official";
  }
  if (!segments.length) {
    const transcription = await transcribeAudio(resolved.audioUrl);
    segments = transcription.segments;
    sourceLanguage = transcription.language;
    transcriptSource = "generated";
  }
  if (!segments.length) throw new Error("The transcript did not contain timed sentences.");
  const translated = await translateSegments(segments, targetLanguage);
  const payload: EpisodePayload = {
    id: crypto.randomUUID(), sourceUrl, audioUrl: resolved.audioUrl, title: resolved.title,
    duration: resolved.duration || segments.at(-1)?.endTime || 0, sourceLanguage, targetLanguage,
    artworkUrl: resolved.artworkUrl, cached: false, transcriptSource,
    segments: segments.map((segment, index) => ({ ...segment, id: `${index + 1}`, translatedText: translated[index] })),
  };
  await cacheEpisode(payload, resolved.feedUrl);
  return payload;
}
