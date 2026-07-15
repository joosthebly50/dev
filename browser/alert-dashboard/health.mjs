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

const execFileP = promisify(execFile);

// The lab-facing interface (192.168.50.254, see NETWORK.md) -- more
// relevant to a SOC dashboard than the host's general internet uplink.
const NETWORK_INTERFACE = 'virbr10';

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

async function readNetBytes() {
  const text = await fs.readFile('/proc/net/dev', 'utf8');
  const line = text.split('\n').find((l) => l.trim().startsWith(`${NETWORK_INTERFACE}:`));
  if (!line) return null;
  const fields = line.split(':')[1].trim().split(/\s+/).map(Number);
  return { rx: fields[0], tx: fields[8] };
}

async function getNetworkThroughputKbps() {
  const a = await readNetBytes();
  if (!a) return null;
  await new Promise((r) => setTimeout(r, 100));
  const b = await readNetBytes();
  if (!b) return null;
  const rxKbps = Math.round(((b.rx - a.rx) * 8) / 1024 / 0.1);
  const txKbps = Math.round(((b.tx - a.tx) * 8) / 1024 / 0.1);
  return { rxKbps, txKbps };
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
  const [cpu, cpuTempC, cpuGHz, mem, disk, net, gpu] = await Promise.all([
    getCpuPercent().catch(() => null),
    getCpuTempC().catch(() => null),
    getCpuClockGHz().catch(() => null),
    getMemPercent().catch(() => null),
    getDiskPercent().catch(() => null),
    getNetworkThroughputKbps().catch(() => null),
    getGpuStats().catch(() => null),
  ]);
  return { cpu, cpuTempC, cpuGHz, mem, disk, net, gpu, interface: NETWORK_INTERFACE };
}
