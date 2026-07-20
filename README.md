# Duplex

Duplex is a minimal podcast player for language learners. It shows only the sentence currently being spoken and a literal translation underneath, while the listener remains in full control of playback.

## What works

- Open RSS feed resolution (latest playable episode)
- Podcast show search through Apple’s podcast directory
- Recent-episode selection from a show’s RSS feed
- Ready-to-play examples sourced from episodes already cached in Supabase
- Apple Podcasts, podcast website, RSS, and direct-audio link resolution
- Podcasting 2.0 official transcript discovery
- OpenAI timestamped transcription fallback
- Literal, sentence-level OpenAI translation
- Supabase transcript and translation cache
- Synchronized one-sentence reading view
- Play, pause, seek, back 30 seconds, and playback speed
- Credential-free demo fixture for development and reliable tests
- Responsive and accessible web interface

## Local setup

Requirements: Node.js 22.13 or newer and a Supabase project.

1. Install dependencies: `npm ci`
2. Copy `.env.example` to `.env.local` and add your credentials.
3. Set `SUPABASE_DATABASE_URL` and run `npm run db:migrate`.
4. Start the app with `npm run dev`.
5. Open the URL printed by the development server.

The built-in **Try the demo** flow works without OpenAI or Supabase credentials. Real podcast processing requires `OPENAI_API_KEY`. Shared caching requires the three Supabase variables in `.env.example`.

Audio downloads exist only in request memory while OpenAI transcription is running and are not written to disk. When an episode has no official transcript, Duplex transcribes only its opening 20 MB. It requests just that byte range when the podcast host supports range requests and ignores the remainder of the episode.

## Quality checks

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:unit`
- `npm run test:e2e`
- `npm test`

The end-to-end suite starts the app, uses the mocked public podcast fixture, and verifies metadata, transcript and translation display, sentence timing, controls, repeatable cached loading, and errors without relying on third-party network availability.

## Deployment

Import the GitHub repository into Vercel, add the environment variables from `.env.example`, run the migration once against Supabase, and deploy. Vercel automatically detects the standard Next.js build. The server-side service-role key must never be exposed with a `NEXT_PUBLIC_` prefix.

## Architecture

`GET /api/podcasts/search` finds shows, and `POST /api/podcasts/episodes` reads the selected show’s RSS feed without processing audio. `POST /api/episodes` then validates the selected episode or resolves a pasted link, checks Supabase, discovers an official timed transcript or sends the opening audio chunk to OpenAI, translates in bounded batches, and caches the result. The browser receives only the processed episode payload and synchronizes it against the native audio element.
