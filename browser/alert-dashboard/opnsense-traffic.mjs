// WAN traffic-spike detection for the health bar, via OPNsense's own
// interface counters (/api/diagnostics/traffic/interface) -- NOT this
// host's own network stats (health.mjs), which only see this one machine's
// traffic. A DDoS/flood targets the WAN link itself, so the signal has to
// come from OPNsense, the only thing that actually sees the WAN interface.
// Read-only (GET, no CSRF needed) -- same daemon-page pattern as
// opnsense-block.mjs.
import { chromium } from 'playwright';

const CDP_URL = 'http://127.0.0.1:9333';

async function fetchWanCounters() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? (await context.newPage());
  return page.evaluate(async () => {
    try {
      const res = await fetch('/api/diagnostics/traffic/interface', { credentials: 'same-origin' });
      const json = await res.json();
      const wan = json?.interfaces?.wan;
      if (!wan) return null;
      return {
        time: json.time,
        bytesIn: Number(wan['bytes received']),
        bytesOut: Number(wan['bytes transmitted']),
      };
    } catch {
      return null;
    }
  });
}

let lastSample = null; // { time, bytesIn, bytesOut }
const rateHistory = []; // rolling window of { inMbps, outMbps }, newest last
const BASELINE_WINDOW = 12; // ~ last 2 minutes at a 10s poll interval

let current = { inMbps: 0, outMbps: 0, baselineInMbps: 0, spike: false, available: false };

export function getWanTrafficState() {
  return current;
}

export async function pollWanTrafficOnce() {
  const sample = await fetchWanCounters().catch(() => null);
  if (!sample) {
    current = { ...current, available: false };
    return current;
  }
  if (lastSample) {
    const dt = sample.time - lastSample.time;
    if (dt > 0) {
      const inMbps = ((sample.bytesIn - lastSample.bytesIn) * 8) / dt / 1_000_000;
      const outMbps = ((sample.bytesOut - lastSample.bytesOut) * 8) / dt / 1_000_000;
      // Counters can wrap/reset (interface reset, OPNsense reboot) -- a
      // negative delta is impossible for real traffic, so drop that sample
      // rather than record a bogus negative rate.
      if (inMbps >= 0 && outMbps >= 0) {
        rateHistory.push({ inMbps, outMbps });
        while (rateHistory.length > BASELINE_WINDOW) rateHistory.shift();

        const baselineSamples = rateHistory.slice(0, -1); // exclude current sample from its own baseline
        const baselineInMbps = baselineSamples.length
          ? baselineSamples.reduce((s, r) => s + r.inMbps, 0) / baselineSamples.length
          : inMbps;

        // Spike: current inbound rate is both a large multiple of recent
        // baseline AND above an absolute floor -- the floor avoids flagging
        // normal noise when baseline is near-zero (e.g. 0.05 -> 0.5 Mbps is
        // technically "10x" but meaningless).
        const spike = baselineSamples.length >= 3 && inMbps > Math.max(baselineInMbps * 5, 20) && inMbps > 5;

        current = { inMbps, outMbps, baselineInMbps, spike, available: true };
      }
    }
  }
  lastSample = sample;
  return current;
}
