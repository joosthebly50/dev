// Single source of truth for every SOC Homelab web destination. Every
// module imports VIEWS from here rather than hardcoding URLs, so adding a
// future area (e.g. a Sigma-rule editor deep link) means editing one file.
//
// Security Onion routes verified live (2026-07-12) by reading the actual
// sidebar hrefs while logged in -- not guessed. Kibana/Fleet routes
// verified by successful navigation + screenshot.
export const BASE = 'https://192.168.50.30';

export const VIEWS = {
  overview: `${BASE}/#/`,
  alerts: `${BASE}/#/alerts`,
  onionAi: `${BASE}/#/assistant`,
  dashboards: `${BASE}/#/dashboards`,
  hunt: `${BASE}/#/hunt`,
  cases: `${BASE}/#/cases`,
  detections: `${BASE}/#/detections`,
  pcap: `${BASE}/#/jobs`, // SO's own nav labels this "PCAP", route is /jobs
  grid: `${BASE}/#/grid`,
  downloads: `${BASE}/#/downloads`,
  // "Administration" is a menu grouping several sub-pages; default to Users.
  administration: `${BASE}/#/users`,
  users: `${BASE}/#/users`,
  gridMembers: `${BASE}/#/gridmembers`,
  configuration: `${BASE}/#/config`,
  licenseKey: `${BASE}/#/licensekey`,
  kibana: `${BASE}/kibana/app/home`,
  fleet: `${BASE}/kibana/app/fleet/agents`,
  fleetPolicies: `${BASE}/kibana/app/fleet/policies`,
  discover: `${BASE}/kibana/app/discover`,
  stackMonitoring: `${BASE}/kibana/app/monitoring`,
};

// The set opened by --all and by the Security Onion Operator launcher's
// "open everything" action -- matches what was actually asked for.
export const VIEW_ORDER = [
  'overview',
  'hunt',
  'detections',
  'cases',
  'grid',
  'administration',
  'pcap',
  'kibana',
  'fleet',
];
