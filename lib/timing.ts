import type { TranscriptSegment } from "./types";

export function findActiveSegment(segments: TranscriptSegment[], timeSeconds: number) {
  if (!segments.length) return -1;
  let low = 0;
  let high = segments.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const segment = segments[middle];
    if (timeSeconds < segment.startTime) high = middle - 1;
    else if (timeSeconds >= segment.endTime) low = middle + 1;
    else return middle;
  }
  return Math.max(0, Math.min(low - 1, segments.length - 1));
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
