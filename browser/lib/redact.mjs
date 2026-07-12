// Best-effort secret scrubbing for anything written to a report file.
// Used by audit.mjs (and any future reporting module) before text ever
// touches disk under browser/artifacts/. Not a substitute for not
// collecting secrets in the first place -- modules should avoid reading
// cookies/tokens/localStorage entirely (see lib/browser.mjs), this is a
// second line of defense for incidental matches in page text.
const PATTERNS = [
  // Common token/key shapes
  [/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED-JWT]'], // JWT-like
  [/\bAPI[_-]?KEY["'=:\s]+[A-Za-z0-9+/_=-]{16,}/gi, 'API_KEY=[REDACTED]'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9+/_=.-]{16,}/g, '$1 [REDACTED]'],
  [/"(access_token|refresh_token|api_key|apiKey|password|passwd|secret)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"'],
  // Cookie-header-shaped strings
  [/\bSet-Cookie:.*/gi, 'Set-Cookie: [REDACTED]'],
  [/\bsid=[^;\s]+/gi, 'sid=[REDACTED]'],
];

export function redact(text) {
  if (typeof text !== 'string') return text;
  let out = text;
  for (const [pattern, replacement] of PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
