import type { EpisodePayload } from "./types";

export const DEMO_URL = "https://demo.duplex.app/deutschlandfunk-kultur.xml";

const source = [
  [0, 5.8, "Wenn wir eine neue Sprache lernen, wollen wir oft jedes einzelne Wort verstehen."],
  [5.8, 11.6, "Aber beim Zuhören entsteht Bedeutung nicht Wort für Wort."],
  [11.6, 18.2, "Wir hören einen Gedanken, eine Pause und dann den nächsten Gedanken."],
  [18.2, 25.1, "Vielleicht ist genau das der Moment, in dem eine fremde Sprache lebendig wird."],
  [25.1, 32, "Man hört nicht mehr nur zu; man beginnt wirklich zu verstehen."],
] as const;

const translations: Record<string, string[]> = {
  en: [
    "When we learn a new language, we often want to understand every single word.",
    "But while listening, meaning does not arise word by word.",
    "We hear one thought, a pause, and then the next thought.",
    "Perhaps that is exactly the moment in which a foreign language becomes alive.",
    "One no longer only listens; one begins truly to understand.",
  ],
  fr: [
    "Lorsque nous apprenons une nouvelle langue, nous voulons souvent comprendre chaque mot individuel.",
    "Mais en écoutant, le sens ne naît pas mot par mot.",
    "Nous entendons une pensée, une pause, puis la pensée suivante.",
    "C’est peut-être précisément le moment où une langue étrangère devient vivante.",
    "On n’écoute plus seulement ; on commence vraiment à comprendre.",
  ],
  es: [
    "Cuando aprendemos un nuevo idioma, a menudo queremos entender cada palabra individual.",
    "Pero al escuchar, el significado no surge palabra por palabra.",
    "Oímos un pensamiento, una pausa y luego el siguiente pensamiento.",
    "Quizás ese sea exactamente el momento en que una lengua extranjera cobra vida.",
    "Uno ya no solo escucha; empieza realmente a entender.",
  ],
};

export function getDemoEpisode(targetLanguage: string): EpisodePayload {
  const translated = translations[targetLanguage] ?? translations.en;
  return {
    id: "demo-episode",
    sourceUrl: DEMO_URL,
    audioUrl: "/api/demo-audio",
    title: "Warum wir durch Zuhören lernen",
    duration: 32,
    sourceLanguage: "de",
    targetLanguage,
    cached: true,
    transcriptSource: "demo",
    segments: source.map(([startTime, endTime, originalText], index) => ({
      id: `demo-${index + 1}`,
      startTime,
      endTime,
      originalText,
      translatedText: translated[index],
    })),
  };
}
