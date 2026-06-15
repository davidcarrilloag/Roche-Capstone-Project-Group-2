// Text-to-speech via the browser's built-in SpeechSynthesis API.
// Free, no key, works in Chrome/Edge/Safari. Used to read answers aloud.

const SPEECH_LANG = { en: "en-US", de: "de-DE", fr: "fr-FR", it: "it-IT" };

export function ttsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Turn the markdown answer into clean prose the synth can read naturally.
function stripMarkdown(md) {
  return (md || "")
    .replace(/```[\s\S]*?```/g, " ")          // code fences
    .replace(/`([^`]+)`/g, "$1")               // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")     // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")   // links -> text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")         // headings
    .replace(/^\s{0,3}>\s?/gm, "")              // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "")              // bullet markers
    .replace(/^\s*\d+\.\s+/gm, "")              // numbered markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2")         // bold
    .replace(/(\*|_)(.*?)\1/g, "$2")            // italic
    .replace(/^\s*([-*_]\s*){3,}\s*$/gm, " ")   // horizontal rules
    .replace(/\n{2,}/g, ". ")                    // paragraph breaks -> pause
    .replace(/\s+/g, " ")
    .trim();
}

// Pick the best installed voice for a language, if any.
function pickVoice(langCode) {
  const voices = window.speechSynthesis.getVoices() || [];
  return (
    voices.find((v) => v.lang?.toLowerCase() === langCode.toLowerCase()) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(langCode.slice(0, 2))) ||
    null
  );
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// Speak `text` in `language` (en/de/fr/it). Calls onEnd when finished or stopped.
export function speak(text, language = "en", { onStart, onEnd } = {}) {
  if (!ttsSupported()) return;
  const clean = stripMarkdown(text);
  if (!clean) return;

  window.speechSynthesis.cancel(); // stop anything already playing
  const langCode = SPEECH_LANG[language] || "en-US";
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = langCode;
  utter.rate = 1;
  utter.pitch = 1;

  const voice = pickVoice(langCode);
  if (voice) utter.voice = voice;

  utter.onstart = () => onStart?.();
  utter.onend = () => onEnd?.();
  utter.onerror = () => onEnd?.();

  // Voices can load asynchronously; if none are ready yet, wait once.
  if ((window.speechSynthesis.getVoices() || []).length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      const v = pickVoice(langCode);
      if (v) utter.voice = v;
      window.speechSynthesis.speak(utter);
      window.speechSynthesis.onvoiceschanged = null;
    };
  } else {
    window.speechSynthesis.speak(utter);
  }
}
