import assert from "node:assert/strict";
import test from "node:test";
import {
  firstAudioChunkEnd,
  transcribeAudio,
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

test("requests and uploads only the opening audio chunk", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const oversizedAudio = new Blob(
    [new Uint8Array(TRANSCRIPTION_CHUNK_BYTES + 1024)],
    { type: "audio/mpeg" },
  );
  let requestNumber = 0;

  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    requestNumber += 1;
    if (requestNumber === 1) {
      assert.equal(input, "https://example.com/episode.mp3");
      assert.deepEqual(init?.headers, {
        range: `bytes=0-${TRANSCRIPTION_CHUNK_BYTES - 1}`,
      });
      return new Response(oversizedAudio, { status: 200 });
    }

    assert.equal(input, "https://api.openai.com/v1/audio/transcriptions");
    const uploadedFile = (init?.body as FormData).get("file");
    assert.ok(uploadedFile instanceof File);
    assert.equal(uploadedFile.size, TRANSCRIPTION_CHUNK_BYTES);
    return Response.json({
      language: "de",
      segments: [{ start: 0, end: 2.5, text: " Guten Tag " }],
    });
  };

  try {
    const transcription = await transcribeAudio("https://example.com/episode.mp3");
    assert.equal(requestNumber, 2);
    assert.equal(transcription.language, "de");
    assert.deepEqual(transcription.segments, [{
      startTime: 0,
      endTime: 2.5,
      originalText: "Guten Tag",
    }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});
