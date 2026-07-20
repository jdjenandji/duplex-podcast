import assert from "node:assert/strict";
import test from "node:test";
import { mapApplePodcastResults } from "../../lib/podcast-discovery";

test("maps Apple podcast search results and ignores entries without feeds", () => {
  assert.deepEqual(mapApplePodcastResults([
    {
      collectionId: 123,
      collectionName: "Geschichten am Abend",
      artistName: "Example Radio",
      feedUrl: "https://example.com/feed.xml",
      artworkUrl600: "https://example.com/artwork.jpg",
    },
    { collectionId: 456, collectionName: "Unavailable show" },
  ]), [{
    id: "123",
    title: "Geschichten am Abend",
    author: "Example Radio",
    feedUrl: "https://example.com/feed.xml",
    artworkUrl: "https://example.com/artwork.jpg",
  }]);
});
