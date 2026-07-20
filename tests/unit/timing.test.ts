import assert from "node:assert/strict";
import test from "node:test";
import { getDemoEpisode } from "../../lib/demo";
import { findActiveSegment, formatTime } from "../../lib/timing";

test("finds the sentence spoken at a precise playback time", () => {
  const segments = getDemoEpisode("en").segments;
  assert.equal(findActiveSegment(segments, 0), 0);
  assert.equal(findActiveSegment(segments, 5.79), 0);
  assert.equal(findActiveSegment(segments, 5.8), 1);
  assert.equal(findActiveSegment(segments, 19), 3);
});

test("uses the closest sentence when playback falls into a timestamp gap", () => {
  const segments = getDemoEpisode("en").segments.slice(0, 2);
  segments[0] = { ...segments[0], endTime: 4 };
  assert.equal(findActiveSegment(segments, 5), 0);
});

test("formats player timestamps", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(65.9), "1:05");
  assert.equal(formatTime(Number.NaN), "0:00");
});

test("the integration fixture has ordered, translated segments", () => {
  const episode = getDemoEpisode("fr");
  assert.equal(episode.cached, true);
  assert.equal(episode.segments.length, 5);
  assert.ok(episode.segments.every((segment, index) => index === 0 || segment.startTime >= episode.segments[index - 1].endTime));
  assert.match(episode.segments[0].translatedText, /Lorsque/);
});
