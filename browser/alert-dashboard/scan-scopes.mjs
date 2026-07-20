// Authorized active-scan targets for the connections-panel SYN-scan button.
//
// This list is the ONLY thing that decides whether the scan button is
// allowed to actually fire (server.mjs enforces it, never trust the
// client). It is intentionally a plain, hand-edited file -- not a setting
// exposed anywhere in the dashboard UI. Active scanning (even a lightweight
// top-100-ports SYN scan) against a target you don't have explicit written
// authorization for is illegal in most jurisdictions and a breach of most
// ISPs' AUP. A UI toggle would make that one accidental click away; a file
// you have to deliberately open and edit is the right amount of friction.
//
// Rule: only add a scope here once you hold signed/written authorization
// (a pentest engagement letter, statement of work, bug bounty program scope,
// etc.) covering that *exact* range, for that *exact* time window. "I'm
// curious" or "it showed up in my connections panel" is never authorization.
// Remove the scope again the moment the engagement window closes.
//
// IPv4 CIDR only for now (see ipInCidr() in server.mjs) -- IPv6 targets
// never match any scope and are always treated as unauthorized, which is
// the safe default until IPv6 CIDR matching is actually needed.
export const AUTHORIZED_SCOPES = [
  {
    cidr: '192.168.50.0/24',
    label: 'SOC Homelab (pentest-lab)',
    authorizedNote: 'Eigen lab -- doorlopend geautoriseerd, geen aparte engagement nodig.',
  },

  // DEMO-entry -- laat zien hoe een tweede scope eruitziet en werkt, zonder
  // enig echt risico: 203.0.113.0/24 is door IANA gereserveerd als
  // "TEST-NET-3" (RFC 5737), specifiek bedoeld voor documentatie/
  // voorbeelden. Dit bereik routeert nergens naartoe op het echte internet
  // -- een scan hiertegen raakt dus nooit een bestaand systeem. Vervang dit
  // door een echte klant-CIDR zodra je een getekende opdracht hebt, en
  // gebruik dan de aantekeningen hieronder als sjabloon.
  {
    cidr: '203.0.113.0/24',
    label: 'DEMO -- TEST-NET-3 (RFC 5737, niet-routeerbaar)',
    authorizedNote: 'Geen echte opdracht -- documentatiebereik, alleen om de tweede-scope-flow te tonen.',
  },

  // Sjabloon voor een echte toekomstige externe opdracht (bijv. als
  // Certified Ethical Hacker/pentester voor een klant). Ontkommentarieer en
  // vul in pas NADAT je schriftelijke autorisatie hebt, en verwijder de
  // entry weer zodra het engagement-venster afloopt:
  //
  // {
  //   cidr: '198.51.100.0/24',
  //   label: 'Klant X -- pentest engagement',
  //   authorizedNote: 'Statement of Work #____, getekend ____, geldig t/m ____.',
  // },
];
