import assert from "node:assert/strict";
import test from "node:test";
import {
  firstAudioChunkEnd,
  listCachedEpisodes,
  listFeedEpisodes,
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

test("lists recent cached episodes as ready-to-play examples", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  globalThis.fetch = async (input) => {
    assert.match(String(input), /episodes\?select=/);
    assert.match(String(input), /limit=6/);
    return Response.json([{
      source_url: "https://example.com/episode",
      feed_url: "https://example.com/feed.xml",
      audio_url: "https://cdn.example.com/episode.mp3",
      title: "A cached episode",
      duration_seconds: 900,
      artwork_url: "https://example.com/art.jpg",
    }]);
  };

  try {
    assert.deepEqual(await listCachedEpisodes(), [{
      sourceUrl: "https://example.com/episode",
      feedUrl: "https://example.com/feed.xml",
      audioUrl: "https://cdn.example.com/episode.mp3",
      title: "A cached episode",
      duration: 900,
      artworkUrl: "https://example.com/art.jpg",
    }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test("lists recent playable episodes from a podcast feed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`<?xml version="1.0"?>
    <rss><channel><title>Example Show</title>
      <itunes:image href="https://example.com/show.jpg" />
      <item>
        <title>Episode Two</title><link>https://example.com/two</link>
        <pubDate>Mon, 20 Jul 2026 08:00:00 GMT</pubDate>
        <itunes:duration>12:34</itunes:duration>
        <enclosure url="https://cdn.example.com/two.mp3" type="audio/mpeg" />
      </item>
      <item><title>Episode One</title><enclosure url="https://cdn.example.com/one.mp3" /></item>
    </channel></rss>`, { headers: { "content-type": "application/rss+xml" } });

  try {
    const episodes = await listFeedEpisodes("https://example.com/feed.xml");
    assert.equal(episodes.length, 2);
    assert.deepEqual(episodes[0], {
      sourceUrl: "https://example.com/two",
      feedUrl: "https://example.com/feed.xml",
      audioUrl: "https://cdn.example.com/two.mp3",
      title: "Episode Two",
      duration: 754,
      artworkUrl: "https://example.com/show.jpg",
      officialTranscriptUrl: undefined,
      publishedAt: "Mon, 20 Jul 2026 08:00:00 GMT",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
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
