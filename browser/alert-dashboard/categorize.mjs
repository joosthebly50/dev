// Attack-type categorization for the SOC Alarmdashboard, v2 taxonomy
// (2026-07-15, Joost's SOC Dashboard v2 roadmap). Expanded from the
// original 7-bucket scheme to 15 categories mapping roughly onto attacker
// kill-chain phases, plus a priority order used by the voice-announcement
// system (dashboard.html) to pick which category to speak when several
// fire in the same batch.
//
// There is no ground-truth mapping from Suricata's own rule categories to
// these 15 buckets -- this is keyword matching against the signature name
// + Suricata's own classification text, documented per-category below.
// When a signature doesn't match confidently, it falls into OTHER rather
// than being force-fit -- per Joost's explicit instruction, this is a
// deliberate default, not a gap to silently patch over. Extend the
// per-category regex below as new signatures are observed; don't invent
// matches for categories that have no real network-visible signal
// (several of these -- Privilege Escalation, Persistence, Credential
// Access, Lateral Movement -- are usually host-based/Sysmon territory,
// not Suricata's strong suit, and will land in OTHER far more often than
// not until host-based sources are integrated, see the "Future
// Integrations" note in docs/guides/alarm_dashboard.md).
//
// IMPORTANT, learned the hard way (2026-07-15, twice): Suricata's own
// classtype free-text fields ("Web Application Attack", "Potentially Bad
// Traffic", "Attempted Administrator Privilege Gain") are reused across
// wildly different rule types and are NOT reliable category-specific
// signals on their own -- e.g. "Web Application Attack" fires on both
// genuine exploit attempts AND on nmap's own recon scripts being
// detected, and "Attempted Administrator Privilege Gain" fires on both
// a real post-exploitation root-shell confirmation AND on an unrelated
// exploit-attempt signature. Rule of thumb applied below: checks based
// on the SIGNATURE NAME's own explicit prefix/keywords run first
// (high-confidence), and checks that rely on the generic classtype text
// alone run LAST, as a low-priority fallback -- never early enough to
// steal a signature that a more specific check should have caught.

export const CATEGORIES = {
  REVERSE_SHELL: { label: 'Reverse Shell', voiceLabel: 'Reverse shell', color: '#e0316b', icon: '\u{1F480}' },
  PRIV_ESC: { label: 'Privilege Escalation', voiceLabel: 'Privilege escalation', color: '#c2185b', icon: '\u{1F451}' },
  EXPLOIT: { label: 'Exploit', voiceLabel: 'Exploit', color: '#d13b3b', icon: '\u{1F4A5}' },
  CRED_ACCESS: { label: 'Credential Access', voiceLabel: 'Credential access', color: '#b5384a', icon: '\u{1F511}' },
  LATERAL_MOVEMENT: { label: 'Lateral Movement', voiceLabel: 'Lateral movement', color: '#a8492f', icon: '\u{27A1}\u{FE0F}' },
  PERSISTENCE: { label: 'Persistence', voiceLabel: 'Persistence', color: '#9c5a26', icon: '\u{1F4CC}' },
  MITM: { label: 'MITM', voiceLabel: 'Man in the middle attack', color: '#8a6d1f', icon: '\u{1F575}\u{FE0F}' },
  WIRELESS: { label: 'Wireless', voiceLabel: 'Wireless attack', color: '#7a7a1f', icon: '\u{1F4F6}' },
  SQLI: { label: 'SQL Injection', voiceLabel: 'S Q L injection', color: '#8a4fd1', icon: '\u{1F5C4}\u{FE0F}' },
  XSS: { label: 'Cross-Site Scripting', voiceLabel: 'Cross site scripting', color: '#c99a1f', icon: '\u{1F4DC}' },
  ENUMERATION: { label: 'Enumeration', voiceLabel: 'Enumeration', color: '#3a7fc1', icon: '\u{1F4CB}' },
  OS_FINGERPRINT: { label: 'OS Fingerprinting', voiceLabel: 'O S fingerprinting', color: '#2f8fb0', icon: '\u{1F9EC}' },
  RECON: { label: 'Recon', voiceLabel: 'Reconnaissance', color: '#2b8fd1', icon: '\u{1F50D}' },
  DOS: { label: 'DoS', voiceLabel: 'Denial of service', color: '#e0672c', icon: '\u{1F30A}' },
  P2P: { label: 'P2P/Torrent', voiceLabel: 'Torrent traffic', color: '#4a7a4a', icon: '\u{1F9F2}' },
  OTHER: { label: 'Overig', voiceLabel: 'Unknown attack', color: '#6b7280', icon: '\u{2139}\u{FE0F}' },
};

// Voice-announcement priority, highest first -- Joost's explicit order.
// When multiple categories appear in the same alert batch, only the
// highest-priority one gets spoken.
export const PRIORITY = [
  'REVERSE_SHELL', 'PRIV_ESC', 'EXPLOIT', 'CRED_ACCESS', 'LATERAL_MOVEMENT',
  'PERSISTENCE', 'MITM', 'WIRELESS', 'SQLI', 'XSS', 'ENUMERATION',
  'OS_FINGERPRINT', 'RECON', 'DOS', 'P2P', 'OTHER',
];

export function priorityRank(bucket) {
  const i = PRIORITY.indexOf(bucket);
  return i === -1 ? PRIORITY.length : i;
}

export function categorize(signature, category) {
  const sig = (signature || '').toLowerCase();
  const cat = (category || '').toLowerCase();
  const s = `${sig} ${cat}`;

  // === High-confidence, signature-name-only checks (run first) ===

  // --- Reverse Shell ---
  if (/reverse[\s.-]?shell|meterpreter|bind[\s.-]?shell|netcat.*(shell|-e )|shellcode/.test(sig)) {
    return 'REVERSE_SHELL';
  }

  // --- Privilege Escalation (strong signal) ---
  // GPL's ATTACK_RESPONSE family specifically detects successful-attack
  // *response content* (e.g. root id output crossing the wire) -- the
  // strongest, most specific signal available for confirmed elevated
  // access. Confirmed via the vsftpd Tier 2 test, 2026-07-15: "GPL
  // ATTACK_RESPONSE id check returned root" fired exactly on the root
  // `id` response, three times.
  if (/attack_response.*(root|admin|id check)/.test(sig)) {
    return 'PRIV_ESC';
  }

  // --- Recon override (must run before the Exploit check below) ---
  // A signature literally prefixed "(ET|GPL) SCAN" or mentioning nmap is
  // recon, full stop. Found via a real dashboard run, 2026-07-15:
  // signatures like "ET SCAN Possible Nmap User-Agent Observed" got
  // miscategorized as Exploit because their classtype text ("Web
  // Application Attack") matched the Exploit check -- this override
  // exists specifically to catch those before that happens.
  if (/^(et|gpl)\s+scan\b/.test(sig) || /\bnmap\b/.test(sig)) {
    return 'RECON';
  }

  // --- P2P / Torrent (Joost's explicit instruction, 2026-07-21: this is
  // expected traffic from his own qBittorrent use, not a threat -- keep it
  // out of OTHER (which would otherwise still sound an alert under the
  // default "Alles uitspreken" setting) so it can be silenced explicitly,
  // see the passesFilter() override in dashboard.html. Deliberately a
  // narrow, signature-name match -- broadening this to generic "p2p"
  // classtype text would risk swallowing genuinely unrelated alerts. ---
  if (/bittorrent|\bp2p\b.*(transfer|handshake|announce|scrape)/.test(sig)) {
    return 'P2P';
  }

  // --- Credential Access ---
  if (/brute[\s.-]?force|credential|kerberoast|password[\s.-]?spray|\bmimikatz\b/.test(sig)) {
    return 'CRED_ACCESS';
  }

  // --- Lateral Movement ---
  if (/\bpsexec\b|\bwmi\b|lateral movement|pass[\s.-]the[\s.-]hash|admin\$ share/.test(sig)) {
    return 'LATERAL_MOVEMENT';
  }

  // --- Persistence ---
  if (/persistence|scheduled task|\bcron\b.*(add|creat|new)|startup registry|service install/.test(sig)) {
    return 'PERSISTENCE';
  }

  // --- MITM ---
  if (/\barp[\s.-]?(spoof|poison)|man[\s.-]in[\s.-]the[\s.-]middle|\bmitm\b|ssl[\s.-]?strip|dns[\s.-]?spoof/.test(sig)) {
    return 'MITM';
  }

  // --- Wireless ---
  // No wireless adapter/traffic exists in this wired lab today -- kept
  // for forward compatibility per the roadmap's "Future Integrations"
  // (WiFi IDS). Will never fire until that's added; harmless to keep.
  if (/\bwireless\b|\bwep\b|\bwpa\b|deauth|wifi.*(attack|crack)|handshake capture/.test(sig)) {
    return 'WIRELESS';
  }

  // --- SQL Injection ---
  if (/sql[\s.-]?injection|\bsqli\b|union[\s.-]select/.test(s)) {
    return 'SQLI';
  }

  // --- Cross-Site Scripting ---
  if (/cross[\s.-]?site[\s.-]?script|\bxss\b/.test(s)) {
    return 'XSS';
  }

  // === Broader signature+category checks (medium confidence) ===

  // --- Exploit ---
  if (/exploit|cve[-_]\d|shellshock|backdoor|trojan|remote code|web application attack/.test(s)) {
    return 'EXPLOIT';
  }

  // --- OS Fingerprinting ---
  // "version attempt" is the strongest signal (matches GPL DNS named
  // version attempt, seen repeatedly this session).
  if (/version attempt|os[\s.-]?(discovery|detection|fingerprint)|banner[\s.-]?grab/.test(s)) {
    return 'OS_FINGERPRINT';
  }

  // --- Enumeration ---
  if (/share access|bind request|\benumerat|rmi request|giop|iiop|netbios|privacy violation/.test(s)) {
    return 'ENUMERATION';
  }

  // --- Recon (generic scan/sweep/probe) ---
  // Deliberately does NOT include "potentially bad traffic" -- that
  // classtype text is Suricata's generic low-confidence bucket, reused
  // across completely unrelated rule types (an ELF file download, a
  // PostgreSQL scan probe, and the ATTACK_RESPONSE root-shell
  // confirmation all carried this exact classtype in real data seen
  // 2026-07-15), so it isn't a reliable category signal at all.
  if (/\bscan\b|sweep|probe|proxy trace|information leak/.test(s)) {
    return 'RECON';
  }

  // --- Denial of Service ---
  if (/denial[\s.-]?of[\s.-]?service|\bddos\b|\bdos\b|\bflood\b/.test(s)) {
    return 'DOS';
  }

  // === Low-priority classtype-only fallback (last resort) ===

  // --- Privilege Escalation (weak signal, generic classtype) ---
  // Catches signatures like "GPL RPC rlogin login failure" (classtype
  // "Attempted Administrator Privilege Gain") that don't have a
  // stronger, more specific signal above. Deliberately checked LAST --
  // this classtype text alone is too broad to trust earlier (see the
  // file-level note), it's only safe to use once every more specific
  // check has already had its chance.
  if (/privilege gain|privilege escalation/.test(cat)) {
    return 'PRIV_ESC';
  }

  return 'OTHER';
}
