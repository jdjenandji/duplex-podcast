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
