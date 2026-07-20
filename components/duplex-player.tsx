"use client";

import {
  ArrowLeft,
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { EpisodePayload, EpisodeSelection, PodcastSearchResult } from "@/lib/types";
import { findActiveSegment, formatTime } from "@/lib/timing";

const DEMO_URL = "https://demo.duplex.app/deutschlandfunk-kultur.xml";
const TARGET_LANGUAGES = [
  ["en", "English"],
  ["fr", "French"],
  ["de", "German"],
  ["es", "Spanish"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["custom", "Other language…"],
] as const;

type Status = "idle" | "loading" | "ready" | "error";

function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function shortDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function DuplexPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [query, setQuery] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [customLanguage, setCustomLanguage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [episode, setEpisode] = useState<EpisodePayload | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState("");
  const [podcasts, setPodcasts] = useState<PodcastSearchResult[]>([]);
  const [episodeChoices, setEpisodeChoices] = useState<EpisodeSelection[]>([]);
  const [selectedPodcastTitle, setSelectedPodcastTitle] = useState("");

  const activeIndex = useMemo(
    () => findActiveSegment(episode?.segments ?? [], currentTime),
    [episode?.segments, currentTime],
  );
  const activeSegment = episode?.segments[activeIndex] ?? null;
  const busy = status === "loading" || isDiscovering;
  const queryIsUrl = isWebUrl(query.trim());

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate]);

  async function loadEpisode(source: string | EpisodeSelection) {
    const selectedLanguage = targetLanguage === "custom" ? customLanguage.trim() : targetLanguage;
    if (!selectedLanguage) return;

    setStatus("loading");
    setError("");
    setIsPlaying(false);
    setCurrentTime(0);

    try {
      const response = await fetch("/api/episodes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(typeof source === "string"
          ? { url: source, targetLanguage: selectedLanguage }
          : { episode: source, targetLanguage: selectedLanguage }),
      });
      const body = (await response.json()) as EpisodePayload & { error?: string };
      if (!response.ok) throw new Error(body.error || "This episode could not be prepared.");
      setEpisode(body);
      setDuration(body.duration);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This episode could not be prepared.");
      setStatus("error");
    }
  }

  async function searchForPodcasts() {
    setIsDiscovering(true);
    setDiscoveryMessage("Searching podcasts…");
    setError("");
    setStatus("idle");
    setEpisodeChoices([]);
    try {
      const response = await fetch(`/api/podcasts/search?q=${encodeURIComponent(query.trim())}`);
      const body = await response.json() as { podcasts?: PodcastSearchResult[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Podcast search failed.");
      if (!body.podcasts?.length) throw new Error("No podcasts matched that search.");
      setPodcasts(body.podcasts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Podcast search failed.");
      setStatus("error");
    } finally {
      setIsDiscovering(false);
      setDiscoveryMessage("");
    }
  }

  async function loadPodcastEpisodes(podcast: PodcastSearchResult) {
    setIsDiscovering(true);
    setDiscoveryMessage("Loading recent episodes…");
    setError("");
    setStatus("idle");
    try {
      const response = await fetch("/api/podcasts/episodes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ feedUrl: podcast.feedUrl }),
      });
      const body = await response.json() as { episodes?: EpisodeSelection[]; error?: string };
      if (!response.ok) throw new Error(body.error || "The podcast episodes could not be loaded.");
      setSelectedPodcastTitle(podcast.title);
      setEpisodeChoices(body.episodes ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The podcast episodes could not be loaded.");
      setStatus("error");
    } finally {
      setIsDiscovering(false);
      setDiscoveryMessage("");
    }
  }

  function submitEntry(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (isWebUrl(value)) void loadEpisode(value);
    else void searchForPodcasts();
  }

  function reset() {
    audioRef.current?.pause();
    setEpisode(null);
    setStatus("idle");
    setCurrentTime(0);
    setIsPlaying(false);
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Math.max(0, Math.min(seconds, duration || 0));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  return (
    <main className="app-shell" data-hydrated="true">
      <header className="topbar">
        <button className="wordmark" onClick={reset} aria-label="Duplex home">
          Duplex<span className="wordmark-dot">.</span>
        </button>
        {status === "ready" ? (
          <button className="episode-back" onClick={reset}>
            <ArrowLeft size={15} strokeWidth={1.8} /> New episode
          </button>
        ) : (
          <p className="principle">Listen. Understand.</p>
        )}
      </header>

      {status !== "ready" ? (
        <section className="entry-view" aria-live="polite">
          <div className="entry-copy">
            <p className="eyebrow">Native podcasts, made clear</p>
            <h1>One sentence.<br />One translation.</h1>
            <p className="intro">
              Search for a show or paste a podcast link, then follow every spoken sentence in real time.
            </p>
          </div>

          <form className="url-form" onSubmit={submitEntry}>
            <label htmlFor="podcast-query">Podcast name or link</label>
            <div className="url-row">
              <input
                id="podcast-query"
                type="text"
                inputMode="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPodcasts([]);
                  setEpisodeChoices([]);
                  setError("");
                  if (status === "error") setStatus("idle");
                }}
                placeholder="Search or paste a podcast link"
                disabled={busy}
                required
              />
              <button className="primary-button" type="submit" disabled={busy || !query.trim()}>
                {busy ? <span className="loader" /> : queryIsUrl
                  ? <Play size={18} fill="currentColor" />
                  : <Search size={17} />}
                {busy ? "Working" : queryIsUrl ? "Listen" : "Search"}
              </button>
            </div>

            <div className="form-meta">
              <label className="language-select">
                Translate into
                <span className="select-wrap">
                  <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
                    {TARGET_LANGUAGES.map(([code, label]) => <option value={code} key={code}>{label}</option>)}
                  </select>
                  <ChevronDown size={13} />
                </span>
              </label>
              {targetLanguage === "custom" && (
                <input
                  className="custom-language"
                  value={customLanguage}
                  onChange={(event) => setCustomLanguage(event.target.value)}
                  placeholder="Language name"
                  aria-label="Custom target language"
                  required
                />
              )}
              <button
                type="button"
                className="demo-button"
                onClick={() => {
                  setQuery(DEMO_URL);
                  void loadEpisode(DEMO_URL);
                }}
                disabled={busy}
              >
                <Sparkles size={14} /> Try the demo
              </button>
            </div>
            {isDiscovering && <p className="status-message">{discoveryMessage}</p>}
            {status === "loading" && <p className="status-message">Finding the transcript and preparing a literal translation…</p>}
            {status === "error" && <p className="error-message" role="alert">{error}</p>}

            {episodeChoices.length > 0 ? (
              <div className="discovery-results" aria-label={`Episodes from ${selectedPodcastTitle}`}>
                <div className="results-heading">
                  <div>
                    <p>Choose an episode</p>
                    <h2>{selectedPodcastTitle}</h2>
                  </div>
                  <button type="button" onClick={() => setEpisodeChoices([])}>Back to shows</button>
                </div>
                <div className="result-list">
                  {episodeChoices.map((choice) => (
                    <button
                      className="episode-result"
                      type="button"
                      key={`${choice.audioUrl}-${choice.title}`}
                      onClick={() => void loadEpisode(choice)}
                      disabled={busy}
                    >
                      <span className="result-copy">
                        <strong>{choice.title}</strong>
                        <small>{[shortDate(choice.publishedAt), choice.duration ? formatTime(choice.duration) : ""].filter(Boolean).join(" · ")}</small>
                      </span>
                      <Play size={14} fill="currentColor" />
                    </button>
                  ))}
                </div>
              </div>
            ) : podcasts.length > 0 ? (
              <div className="discovery-results" aria-label="Podcast search results">
                <div className="results-heading">
                  <div>
                    <p>Shows</p>
                    <h2>Select a podcast</h2>
                  </div>
                </div>
                <div className="result-list">
                  {podcasts.map((podcast) => (
                    <button
                      className="podcast-result"
                      type="button"
                      key={podcast.id}
                      onClick={() => void loadPodcastEpisodes(podcast)}
                      disabled={busy}
                    >
                      <span
                        className="result-artwork"
                        style={podcast.artworkUrl ? { backgroundImage: `url(${podcast.artworkUrl})` } : undefined}
                        aria-hidden="true"
                      />
                      <span className="result-copy">
                        <strong>{podcast.title}</strong>
                        <small>{podcast.author}</small>
                      </span>
                      <span className="result-arrow">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </form>
        </section>
      ) : (
        <section className="listening-view">
          <div className="episode-meta">
            <div>
              <p className="episode-label">Now listening</p>
              <h2>{episode?.title}</h2>
            </div>
            <div className="language-pair">
              <span>{episode?.sourceLanguage.toUpperCase()}</span><span className="pair-line" />
              <span>{(targetLanguage === "custom" ? customLanguage : targetLanguage).toUpperCase()}</span>
            </div>
          </div>

          <div className="sentence-stage" aria-live="polite" aria-atomic="true">
            {activeSegment ? (
              <div className="sentence-pair" key={activeSegment.id}>
                <p className="source-sentence">{activeSegment.originalText}</p>
                <div className="sentence-divider" />
                <p className="translation-sentence">{activeSegment.translatedText}</p>
              </div>
            ) : (
              <div className="sentence-pair">
                <p className="source-sentence">Press play when you’re ready.</p>
                <div className="sentence-divider" />
                <p className="translation-sentence">The translation will follow the speaker.</p>
              </div>
            )}
          </div>

          <div className="player-panel">
            <audio
              ref={audioRef}
              src={episode?.audioUrl}
              preload="metadata"
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onDurationChange={(event) => {
                if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
            <div className="timeline-row">
              <span>{formatTime(currentTime)}</span>
              <input
                aria-label="Seek"
                className="timeline"
                type="range"
                min="0"
                max={duration || 1}
                step="0.1"
                value={Math.min(currentTime, duration || 1)}
                onChange={(event) => seekTo(Number(event.target.value))}
                style={{ "--progress": `${duration ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
              />
              <span>{formatTime(duration)}</span>
            </div>
            <div className="controls-row">
              <button className="control-button back-button" onClick={() => seekTo(currentTime - 30)} aria-label="Back 30 seconds">
                <RotateCcw size={20} /><span>30</span>
              </button>
              <button className="play-button" onClick={() => void togglePlayback()} aria-label={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" className="play-icon" />}
              </button>
              <label className="speed-control">
                <span className="sr-only">Playback speed</span>
                <select value={rate} onChange={(event) => setRate(Number(event.target.value))} aria-label="Playback speed">
                  {[0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}×</option>)}
                </select>
              </label>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
