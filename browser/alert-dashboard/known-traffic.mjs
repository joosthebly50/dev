// Joost's known daily-traffic profile -- the "this is what normal looks
// like on my machine" reference the local triage agent (local-agent.mjs)
// cross-checks alerts against. Hand-edited, extensible, same spirit as
// scan-scopes.mjs: a plain file you deliberately update, not a UI setting,
// because "the agent learned to ignore X" should always be something a
// human can read and audit afterward.
//
// Each entry: which local process(es) this covers, and what "normal"
// looks like for it (typical remote ports). Used two ways:
//  1. Direct match -- an alert's src/dst port falls in a known process's
//     normal range AND that process currently has active connections
//     (same pattern as the existing qBittorrent DDoS-spike exclusion in
//     health.mjs/opnsense-traffic.mjs).
//  2. Correlation -- an alert's counterpart IP shows up as the remote end
//     of one of these processes' connections in the same time window
//     (generalizes the "ET TOR coincided with a torrent burst" case).

export const KNOWN_PROCESSES = [
  {
    name: 'qbittorrent',
    processMatch: ['qbittorrent'],
    normalRemotePorts: [6881, 6882, 6883, 6884, 6885, 6886, 6887, 6888, 6889],
    note: 'BitTorrent peer/DHT traffic -- port range is a convention, not a hard rule, real peers use arbitrary ports too. See categorize.mjs P2P bucket for the direct-signature case; this entry is mainly for the correlation path (a non-BitTorrent-signature alert whose IP is also a current torrent peer).',
  },
  {
    name: 'discord',
    processMatch: ['discord'],
    normalRemotePorts: [443, 80, 50000, 50001, 50002, 50003],
    note: 'Voice/video uses a UDP range around 50000+; everything else is standard HTTPS. Matches VOIP_GAME_KEYWORDS in dashboard.html -- keep both lists in sync if this changes.',
  },
  {
    name: 'steam',
    processMatch: ['steam', 'steamwebhelper'],
    normalRemotePorts: [27015, 27016, 27017, 27018, 27019, 27020, 443, 80],
    note: 'Valve’s classic Source-engine port range plus regular web traffic for the store/friends overlay.',
  },
  {
    name: 'arma-reforger',
    processMatch: ['reforger', 'arma'],
    normalRemotePorts: [2001, 17777],
    note: 'Enfusion-engine default game/query ports.',
  },
  {
    name: 'browser',
    processMatch: ['chrome', 'firefox'],
    normalRemotePorts: [443, 80],
    note: 'Broad and low-signal on purpose -- browsers talk to almost anything on 443. Only useful for ruling out "is this even a browser at all", not for clearing an alert on its own.',
  },
];

// Signature-pattern knowledge base: near-certain verdicts for whole classes
// of noisy ET/GPL signatures that fire constantly on any home network and
// essentially never indicate a real problem there. Deliberately narrow and
// explicit (regex per entry, not a vague classtype match) -- same
// discipline as categorize.mjs's own file-level warning about classtype
// text being unreliable. NOT auto-applied blindly: local-agent.mjs still
// requires the alert to actually match one of these AND have no signal
// that contradicts it (e.g. don't wave through "GPL P2P BitTorrent
// transfer" if it's the very first packet of an otherwise-unexplained
// exfil-sized transfer -- though in practice that signature is specific
// enough this rarely comes up).
export const BENIGN_SIGNATURE_PATTERNS = [
  { pattern: /\bmdns\b/i, reason: 'mDNS (multicast DNS) -- local device discovery, e.g. Chromecasts/printers announcing themselves. Universal home-network background noise.' },
  { pattern: /\bssdp\b|upnp/i, reason: 'SSDP/UPnP -- local device/service discovery broadcast, same category as mDNS.' },
  { pattern: /\bntp\b.*(request|response|mode 3|mode 4)/i, reason: 'NTP time sync -- routine, universal.' },
  { pattern: /dns.?over.?https|\bdoh\b/i, reason: 'DNS-over-HTTPS probe/negotiation -- modern browsers do this by default, not evidence of DNS tunneling on its own.' },
];
// Deliberately NOT included: a blanket telemetry/update-domain rule
// (Google/Microsoft/Mozilla etc). That pattern is too broad and would
// swallow real alerts too easily. Add specific, narrow entries above if a
// genuine repeat false-positive shows up -- don't generalize preemptively.

// Signature patterns that must NEVER be waved through by the local agent,
// regardless of any correlation match -- mirrors the hard safety rule in
// the CronCreate prompt (Documents/decisions/architecture_decisions.md, "False-
// Positive Triage Agent"), enforced here too so the local (button-
// triggered) path can't accidentally be looser than the scheduled one.
export const NEVER_AUTO_DISMISS_BUCKETS = new Set([
  'REVERSE_SHELL', 'PRIV_ESC', 'EXPLOIT', 'CRED_ACCESS', 'LATERAL_MOVEMENT',
  'PERSISTENCE', 'MITM', 'SQLI', 'XSS',
]);
