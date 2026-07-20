import assert from "node:assert/strict";
import test from "node:test";
import {
  firstAudioChunkEnd,
  TRANSCRIPTION_CHUNK_BYTES,
} from "../../lib/pipeline";

test("limits large episode transcription to the first provider-safe chunk", () => {
  assert.equal(
    firstAudioChunkEnd(TRANSCRIPTION_CHUNK_BYTES * 5),
    TRANSCRIPTION_CHUNK_BYTES,
  );
});

test("keeps all of a small episode in the first transcription chunk", () => {
  assert.equal(firstAudioChunkEnd(1024), 1024);
});
