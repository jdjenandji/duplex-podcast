"use client";

import {
  ArrowLeft,
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { EpisodePayload } from "@/lib/types";
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

export function DuplexPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [customLanguage, setCustomLanguage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [episode, setEpisode] = useState<EpisodePayload | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState("");

  const activeIndex = useMemo(
    () => findActiveSegment(episode?.segments ?? [], currentTime),
    [episode?.segments, currentTime],
  );
  const activeSegment = episode?.segments[activeIndex] ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate]);

  async function loadEpisode(event?: FormEvent, overrideUrl?: string) {
    event?.preventDefault();
    const submittedUrl = (overrideUrl ?? url).trim();
    const selectedLanguage = targetLanguage === "custom" ? customLanguage.trim() : targetLanguage;
    if (!submittedUrl || !selectedLanguage) return;

    setStatus("loading");
    setError("");
    setIsPlaying(false);
    setCurrentTime(0);

    try {
      const response = await fetch("/api/episodes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: submittedUrl, targetLanguage: selectedLanguage }),
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
              Paste a podcast feed and follow every spoken sentence in real time—without interrupting the audio.
            </p>
          </div>

          <form className="url-form" onSubmit={loadEpisode}>
            <label htmlFor="podcast-url">Podcast feed or episode URL</label>
            <div className="url-row">
              <input
                id="podcast-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste a podcast URL"
                disabled={status === "loading"}
                required
              />
              <button className="primary-button" type="submit" disabled={status === "loading" || !url.trim()}>
                {status === "loading" ? <span className="loader" /> : <Play size={18} fill="currentColor" />}
                {status === "loading" ? "Preparing" : "Listen"}
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
                  setUrl(DEMO_URL);
                  void loadEpisode(undefined, DEMO_URL);
                }}
                disabled={status === "loading"}
              >
                <Sparkles size={14} /> Try the demo
              </button>
            </div>
            {status === "loading" && <p className="status-message">Finding the transcript and preparing a literal translation…</p>}
            {status === "error" && <p className="error-message" role="alert">{error}</p>}
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
