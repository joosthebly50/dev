// Best-effort categorization of Suricata alerts into the attack-type
// buckets Joost asked for. There's no ground-truth mapping from Suricata's
// own rule categories to these six buckets, so this is keyword matching
// against the signature name + Suricata's own classification text, in
// priority order (most specific first). Anything that doesn't match a
// specific bucket falls into "Overig" rather than being force-fit.

export const CATEGORIES = {
  REVERSE_SHELL: { label: 'Reverse Shell', color: '#e0316b', icon: '\u{1F480}' },
  SQLI: { label: 'SQL Injection', color: '#8a4fd1', icon: '\u{1F5C4}\u{FE0F}' },
  XSS: { label: 'Cross-Site Scripting', color: '#c99a1f', icon: '\u{1F4DC}' },
  DDOS: { label: 'DDoS / DoS', color: '#e0672c', icon: '\u{1F30A}' },
  EXPLOIT: { label: 'Exploit', color: '#d13b3b', icon: '\u{1F4A5}' },
  SCAN: { label: 'Scan / Recon', color: '#2b8fd1', icon: '\u{1F50D}' },
  OTHER: { label: 'Overig', color: '#6b7280', icon: '\u{2139}\u{FE0F}' },
};

export function categorize(signature, category) {
  const s = `${signature || ''} ${category || ''}`.toLowerCase();

  if (/reverse[\s.-]?shell|meterpreter|bind[\s.-]?shell|netcat.*(shell|-e )|shellcode/.test(s)) {
    return 'REVERSE_SHELL';
  }
  if (/sql[\s.-]?injection|\bsqli\b|union[\s.-]select/.test(s)) {
    return 'SQLI';
  }
  if (/cross[\s.-]?site[\s.-]?script|\bxss\b/.test(s)) {
    return 'XSS';
  }
  if (/denial[\s.-]?of[\s.-]?service|\bddos\b|\bdos\b|\bflood\b/.test(s)) {
    return 'DDOS';
  }
  if (/exploit|cve[-_]\d|shellshock|backdoor|trojan|privilege gain|remote code|web application attack/.test(s)) {
    return 'EXPLOIT';
  }
  if (/\bscan\b|nmap|sweep|probe|enumerat|recon|version attempt|share access|bind request|information leak|potentially bad traffic|privacy violation/.test(s)) {
    return 'SCAN';
  }
  return 'OTHER';
}
