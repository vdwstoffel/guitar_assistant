const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/webm;codecs=opus": ".webm",
  "audio/ogg": ".ogg",
  "audio/ogg;codecs=opus": ".ogg",
  "audio/mp4": ".mp4",
  "audio/mp4;codecs=mp4a.40.2": ".mp4",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
};

/** File extension (with dot) for an audio MIME type; `.webm` when unknown. */
export function audioExtension(mime: string): string {
  if (MIME_TO_EXT[mime]) return MIME_TO_EXT[mime];
  const base = mime.split(";")[0].trim();
  return MIME_TO_EXT[base] || ".webm";
}
