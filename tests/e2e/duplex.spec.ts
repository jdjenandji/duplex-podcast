import { expect, test } from "@playwright/test";
import { getDemoEpisode } from "../../lib/demo";

async function waitForApp(page: import("@playwright/test").Page) {
  await expect(page.locator("main[data-hydrated=true]")).toBeVisible();
}

test("loads the repeatable podcast fixture and synchronizes sentences", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /One sentence/i })).toBeVisible();
  await waitForApp(page);
  await page.getByRole("button", { name: /Try the demo/i }).click();

  await expect(page.getByText("Warum wir durch Zuhören lernen")).toBeVisible();
  await expect(page.getByText(/Wenn wir eine neue Sprache lernen/)).toBeVisible();
  await expect(page.getByText(/When we learn a new language/)).toBeVisible();

  await page.locator("audio").evaluate((audio: HTMLAudioElement) => {
    audio.currentTime = 7;
    audio.dispatchEvent(new Event("timeupdate"));
  });
  await expect(page.getByText(/Bedeutung nicht Wort für Wort/)).toBeVisible();
  await expect(page.getByText(/meaning does not arise word by word/)).toBeVisible();

  await page.getByRole("button", { name: "New episode" }).click();
  await page.getByRole("button", { name: /Try the demo/i }).click();
  await expect(page.getByText("Warum wir durch Zuhören lernen")).toBeVisible();
});

test("playback controls play, pause, seek, go back, and change speed", async ({ page }) => {
  await page.goto("/");
  await waitForApp(page);
  await page.getByRole("button", { name: /Try the demo/i }).click();
  const audio = page.locator("audio");

  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();

  await page.getByLabel("Seek").fill("20");
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => Math.round(element.currentTime))).toBe(20);
  await page.getByRole("button", { name: "Back 30 seconds" }).click();
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => Math.round(element.currentTime))).toBe(0);

  await page.getByLabel("Playback speed").selectOption("1.5");
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.playbackRate)).toBe(1.5);
});

test("handles processing errors without disrupting the page", async ({ page }) => {
  await page.route("**/api/episodes", (route) => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "No playable audio was found in this episode." }) }));
  await page.goto("/");
  await waitForApp(page);
  await page.getByLabel("Podcast name or link").fill("https://example.com/not-a-podcast");
  await page.getByRole("button", { name: "Listen" }).click();
  await expect(page.locator(".error-message")).toContainText("No playable audio");
});

test("searches for a show and lets the listener choose an episode", async ({ page }) => {
  await page.route("**/api/podcasts/cached", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ episodes: [{
      sourceUrl: "https://example.com/cached-episode",
      feedUrl: "https://example.com/feed.xml",
      audioUrl: "https://example.com/cached-episode.mp3",
      title: "A ready German episode",
      duration: 900,
    }] }),
  }));
  await page.route("**/api/podcasts/search?**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ podcasts: [{
      id: "123",
      title: "Make Economy Great Again",
      author: "WELT",
      feedUrl: "https://example.com/feed.xml",
    }] }),
  }));
  await page.route("**/api/podcasts/episodes", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ episodes: [{
      sourceUrl: "https://example.com/episode-2",
      feedUrl: "https://example.com/feed.xml",
      audioUrl: "https://example.com/episode-2.mp3",
      title: "Die neue Weltordnung",
      duration: 1200,
      publishedAt: "2026-07-20T08:00:00Z",
    }] }),
  }));
  await page.route("**/api/episodes", async (route) => {
    const request = route.request().postDataJSON();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      ...getDemoEpisode("en"),
      title: request.episode.title,
    }) });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cached examples" })).toBeVisible();
  await page.getByRole("button", { name: /A ready German episode/ }).click();
  await expect(page.getByText("A ready German episode")).toBeVisible();
  await page.getByRole("button", { name: "New episode" }).click();
  await page.getByLabel("Podcast name or link").fill("Make Economy Great Again");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: /Make Economy Great Again/ }).click();
  await page.getByRole("button", { name: /Die neue Weltordnung/ }).click();

  await expect(page.getByText("Die neue Weltordnung")).toBeVisible();
  await expect(page.getByText(/Wenn wir eine neue Sprache lernen/)).toBeVisible();
});
