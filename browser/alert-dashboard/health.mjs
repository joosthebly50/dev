// Local host system metrics for the SOC Alarmdashboard's health bar
// (CPU/RAM/Disk/Network/GPU) -- read directly from /proc, /sys/class/hwmon
// and nvidia-smi on the Bazzite host itself, no external dependency, no
// network call. This is the same class of source MangoHud itself reads
// from -- there's no MangoHud "API" to call into (it's a Vulkan/OpenGL
// overlay layer for games, not a background service with an interface),
// so matching its responsiveness just means polling this ourselves more
// often, not invoking MangoHud directly. Security Onion's own component
// health (Suricata/Zeek/Elasticsearch/Fleet) is a separate, not-yet-built
// piece -- see docs/guides/alarm_dashboard.md "Toekomstige uitbreidbaarheid".
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getActiveConnections } from './connections.mjs';

const execFileP = promisify(execFile);

// The lab-facing interface (192.168.50.254, see NETWORK.md) -- more
// relevant to a SOC dashboard than the host's general internet uplink.
const NETWORK_INTERFACE = 'virbr10';

// Joost's actual internet-facing NIC (192.168.2.6, behind his KPN modem/
// router) -- confirmed via `ip -br addr` 2026-07-20. Separate from the lab
// entirely: this host is dual-homed, with the pentest lab (virbr10, above)
// isolated behind OPNsense on a different subnet. Gaming/Discord/general
// traffic all goes out here, so THIS is the interface that matters for
// "am I being flooded" -- not the lab bridge, and not OPNsense's WAN (which
// currently only serves the isolated lab, not this host's own internet
// path -- see docs/guides/alarm_dashboard.md, "WAN-piekdetectie").
// Hardcoded interface name, like NETWORK_INTERFACE above: not guaranteed
// stable if hardware changes, but stable across reboots on this host.
const KPN_INTERFACE = 'enp6s0';

function parseProcStatCpuLine(text) {
  // First line of /proc/stat: "cpu  user nice system idle iowait irq softirq steal ..."
  const line = text.split('\n')[0];
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const [user, nice, system, idle, iowait, irq, softirq, steal] = parts;
  const idleTime = idle + (iowait || 0);
  const total = user + nice + system + idleTime + (irq || 0) + (softirq || 0) + (steal || 0);
  return { idleTime, total };
}

async function getCpuPercent() {
  const a = parseProcStatCpuLine(await fs.readFile('/proc/stat', 'utf8'));
  await new Promise((r) => setTimeout(r, 100));
  const b = parseProcStatCpuLine(await fs.readFile('/proc/stat', 'utf8'));
  const totalDelta = b.total - a.total;
  const idleDelta = b.idleTime - a.idleTime;
  if (totalDelta <= 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 100);
}

// hwmon device numbering (hwmon0, hwmon1, ...) isn't guaranteed stable
// across reboots -- found the "coretemp" one dynamically by name each
// time rather than hardcoding a path (this system: hwmon3, but that's
// not a safe assumption to bake in).
let cachedCoretempPath = null;
async function findCoretempPackagePath() {
  if (cachedCoretempPath) return cachedCoretempPath;
  const hwmonDir = '/sys/class/hwmon';
  const entries = await fs.readdir(hwmonDir);
  for (const entry of entries) {
    const namePath = `${hwmonDir}/${entry}/name`;
    const name = await fs.readFile(namePath, 'utf8').catch(() => '');
    if (name.trim() !== 'coretemp') continue;
    const dir = `${hwmonDir}/${entry}`;
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (!f.endsWith('_label')) continue;
      const label = await fs.readFile(`${dir}/${f}`, 'utf8').catch(() => '');
      if (label.trim() === 'Package id 0') {
        cachedCoretempPath = `${dir}/${f.replace('_label', '_input')}`;
        return cachedCoretempPath;
      }
    }
  }
  return null;
}

async function getCpuTempC() {
  const path = await findCoretempPackagePath();
  if (!path) return null;
  const raw = await fs.readFile(path, 'utf8').catch(() => null);
  if (!raw) return null;
  return Math.round(Number(raw.trim()) / 1000);
}

async function getCpuClockGHz() {
  try {
    const cpuDirs = (await fs.readdir('/sys/devices/system/cpu'))
      .filter((d) => /^cpu\d+$/.test(d));
    const freqs = await Promise.all(
      cpuDirs.map((d) =>
        fs.readFile(`/sys/devices/system/cpu/${d}/cpufreq/scaling_cur_freq`, 'utf8')
          .then((v) => Number(v.trim()))
          .catch(() => null)
      )
    );
    const valid = freqs.filter((f) => f != null && f > 0);
    if (!valid.length) return null;
    const avgKHz = valid.reduce((a, b) => a + b, 0) / valid.length;
    return Math.round((avgKHz / 1_000_000) * 100) / 100; // GHz, 2 decimals
  } catch {
    return null;
  }
}

async function getMemPercent() {
  const text = await fs.readFile('/proc/meminfo', 'utf8');
  const get = (name) => {
    const m = text.match(new RegExp(`^${name}:\\s+(\\d+)`, 'm'));
    return m ? Number(m[1]) : 0;
  };
  const total = get('MemTotal');
  const available = get('MemAvailable');
  if (!total) return 0;
  return Math.round(((total - available) / total) * 100);
}

// NOT "/" -- this is a Bazzite (ostree/composefs) immutable OS, where "/"
// is a small, always-100%-full read-only image overlay by design (found
// 2026-07-15 while testing this exact check: df showed a 45MB, 100%-full
// "/" and nearly reported that as the host's disk usage). The real,
// meaningful mount is /var/home -- a LUKS-encrypted btrfs volume where
// actual user data, the VMs, and this project all live.
const DISK_PATH = '/var/home';

async function getDiskPercent() {
  try {
    const { stdout } = await execFileP('df', ['-B1', '--output=size,used', DISK_PATH]);
    const line = stdout.trim().split('\n')[1];
    const [size, used] = line.trim().split(/\s+/).map(Number);
    if (!size) return 0;
    return Math.round((used / size) * 100);
  } catch {
    return null;
  }
}

async function readNetBytes(iface) {
  const text = await fs.readFile('/proc/net/dev', 'utf8');
  const line = text.split('\n').find((l) => l.trim().startsWith(`${iface}:`));
  if (!line) return null;
  const fields = line.split(':')[1].trim().split(/\s+/).map(Number);
  return { rx: fields[0], tx: fields[8] };
}

async function getNetworkThroughputKbps() {
  const a = await readNetBytes(NETWORK_INTERFACE);
  if (!a) return null;
  await new Promise((r) => setTimeout(r, 100));
  const b = await readNetBytes(NETWORK_INTERFACE);
  if (!b) return null;
  const rxKbps = Math.round(((b.rx - a.rx) * 8) / 1024 / 0.1);
  const txKbps = Math.round(((b.tx - a.tx) * 8) / 1024 / 0.1);
  return { rxKbps, txKbps };
}

// --- WAN (KPN) traffic-spike detection ----------------------------------
// Same instantaneous-rate technique as getNetworkThroughputKbps() (sample
// twice, 100ms apart), plus a rolling baseline maintained ACROSS polls
// (module-level state, not reset each call -- pollHealth() on the client
// calls getHostHealth() every 1s, so this naturally builds a ~2 minute
// baseline window over time).
const WAN_BASELINE_WINDOW = 120; // ~2 minutes at a 1s poll interval
const wanRateHistory = []; // { inMbps }, newest last

async function getWanTraffic() {
  const a = await readNetBytes(KPN_INTERFACE);
  if (!a) return null;
  await new Promise((r) => setTimeout(r, 100));
  const b = await readNetBytes(KPN_INTERFACE);
  if (!b) return null;
  const inMbps = ((b.rx - a.rx) * 8) / 1024 / 1024 / 0.1;
  const outMbps = ((b.tx - a.tx) * 8) / 1024 / 1024 / 0.1;

  const baselineSamples = wanRateHistory.slice();
  const baselineInMbps = baselineSamples.length
    ? baselineSamples.reduce((s, r) => s + r.inMbps, 0) / baselineSamples.length
    : inMbps;

  wanRateHistory.push({ inMbps });
  while (wanRateHistory.length > WAN_BASELINE_WINDOW) wanRateHistory.shift();

  // Spike: inbound rate is both a large multiple of the recent baseline AND
  // above an absolute floor -- the floor avoids flagging normal noise when
  // baseline is near-zero (idle connection -> any small blip would
  // otherwise look like "infinite times baseline"). Floor raised to 500
  // Mbps (Joost's explicit request, 2026-07-20) after a legitimate torrent
  // burst peaked around ~516 Mbps and correctly-but-unhelpfully triggered
  // the old 30 Mbps floor -- 500 Mbps sits above normal heavy-download
  // bursts on his connection while still catching a real flood.
  const WAN_SPIKE_FLOOR_MBPS = 500;
  let spike = baselineSamples.length >= 10 && inMbps > Math.max(baselineInMbps * 6, WAN_SPIKE_FLOOR_MBPS);

  // Exclude qBittorrent (Joost's explicit request, 2026-07-20): the metric
  // can't be filtered per-process at the /proc/net/dev level (that's
  // whole-interface, not per-socket), so instead the spike *flag* is
  // suppressed for any poll where qBittorrent currently has active
  // connections -- Mbps/baseline are still recorded and shown normally,
  // only the "possible DDoS" alert is skipped while a known, expected
  // heavy-traffic process is running.
  if (spike) {
    const connections = await getActiveConnections().catch(() => []);
    const torrentActive = connections.some((c) => (c.process || '').toLowerCase().includes('qbittorrent'));
    if (torrentActive) spike = false;
  }

  return {
    inMbps: Math.round(inMbps * 10) / 10,
    outMbps: Math.round(outMbps * 10) / 10,
    baselineInMbps: Math.round(baselineInMbps * 10) / 10,
    spike,
  };
}

async function getGpuStats() {
  try {
    const { stdout } = await execFileP('nvidia-smi', [
      '--query-gpu=temperature.gpu,utilization.gpu,memory.used,memory.total',
      '--format=csv,noheader,nounits',
    ]);
    const [temp, util, memUsed, memTotal] = stdout.trim().split(',').map((s) => Number(s.trim()));
    return {
      tempC: temp,
      utilPercent: util,
      vramUsedMiB: memUsed,
      vramTotalMiB: memTotal,
      vramPercent: memTotal ? Math.round((memUsed / memTotal) * 100) : null,
    };
  } catch {
    return null; // no GPU / nvidia-smi unavailable -- not an error, just omit
  }
}

export async function getHostHealth() {
  const [cpu, cpuTempC, cpuGHz, mem, disk, net, gpu, wan] = await Promise.all([
    getCpuPercent().catch(() => null),
    getCpuTempC().catch(() => null),
    getCpuClockGHz().catch(() => null),
    getMemPercent().catch(() => null),
    getDiskPercent().catch(() => null),
    getNetworkThroughputKbps().catch(() => null),
    getGpuStats().catch(() => null),
    getWanTraffic().catch(() => null),
  ]);
  return { cpu, cpuTempC, cpuGHz, mem, disk, net, gpu, wan, interface: NETWORK_INTERFACE, wanInterface: KPN_INTERFACE };
}
