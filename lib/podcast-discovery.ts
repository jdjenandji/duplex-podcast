import type { PodcastSearchResult } from "./types";

type ApplePodcastResult = {
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  collectionId?: number;
  collectionName?: string;
  feedUrl?: string;
};

export function mapApplePodcastResults(results: ApplePodcastResult[]): PodcastSearchResult[] {
  return results
    .filter((result) => result.feedUrl && result.collectionName)
    .map((result) => ({
      id: String(result.collectionId ?? result.feedUrl),
      title: result.collectionName!,
      author: result.artistName || "Unknown publisher",
      feedUrl: result.feedUrl!,
      artworkUrl: result.artworkUrl600 || result.artworkUrl100,
    }));
}

export async function searchPodcasts(query: string): Promise<PodcastSearchResult[]> {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("media", "podcast");
  url.searchParams.set("entity", "podcast");
  url.searchParams.set("limit", "8");

  const response = await fetch(url, {
    headers: { "user-agent": "Duplex/0.1 podcast language player" },
  });
  if (!response.ok) throw new Error("Podcast search is temporarily unavailable.");
  const body = await response.json() as { results?: ApplePodcastResult[] };
  return mapApplePodcastResults(body.results ?? []);
}
