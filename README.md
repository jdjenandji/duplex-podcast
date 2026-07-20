# Duplex

Duplex is a minimal podcast player for language learners. It shows only the sentence currently being spoken and a literal translation underneath, while the listener remains in full control of playback.

## What works

- Open RSS feed resolution (latest playable episode)
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

Audio downloads exist only in request memory while OpenAI transcription is running and are not written to disk. The MVP rejects audio larger than 24 MB with a clear error.

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

`POST /api/episodes` validates and resolves a URL, checks Supabase, discovers an official timed transcript or sends the temporary audio blob to OpenAI, translates in bounded batches, then caches the episode, timed sentence rows, and target-language translations. The browser receives only the processed episode payload and synchronizes it against the native audio element.
