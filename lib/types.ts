export type TranscriptSegment = {
  id: string;
  startTime: number;
  endTime: number;
  originalText: string;
  translatedText: string;
};

export type EpisodePayload = {
  id: string;
  sourceUrl: string;
  audioUrl: string;
  title: string;
  duration: number;
  sourceLanguage: string;
  targetLanguage: string;
  artworkUrl?: string;
  cached: boolean;
  transcriptSource: "official" | "generated" | "demo";
  segments: TranscriptSegment[];
};

export type PodcastSearchResult = {
  id: string;
  title: string;
  author: string;
  feedUrl: string;
  artworkUrl?: string;
};

export type EpisodeSelection = {
  sourceUrl: string;
  feedUrl: string;
  audioUrl: string;
  title: string;
  duration: number;
  artworkUrl?: string;
  officialTranscriptUrl?: string;
  publishedAt?: string;
};
