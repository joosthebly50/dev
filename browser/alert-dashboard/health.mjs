// Local host system metrics for the SOC Alarmdashboard's health bar
// (CPU/RAM/Disk/Network/GPU) -- read directly from /proc and nvidia-smi
// on the Bazzite host itself, no external dependency, no network call.
// Security Onion's own component health (Suricata/Zeek/Elasticsearch/
// Fleet) is a separate, not-yet-built piece -- see
// docs/guides/alarm_dashboard.md "Toekomstige uitbreidbaarheid".
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
  await new Promise((r) => setTimeout(r, 150));
  const b = parseProcStatCpuLine(await fs.readFile('/proc/stat', 'utf8'));
  const totalDelta = b.total - a.total;
  const idleDelta = b.idleTime - a.idleTime;
  if (totalDelta <= 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 100);
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
  await new Promise((r) => setTimeout(r, 200));
  const b = await readNetBytes();
  if (!b) return null;
  const rxKbps = Math.round(((b.rx - a.rx) * 8) / 1024 / 0.2);
  const txKbps = Math.round(((b.tx - a.tx) * 8) / 1024 / 0.2);
  return { rxKbps, txKbps };
}

async function getGpuStats() {
  try {
    const { stdout } = await execFileP('nvidia-smi', [
      '--query-gpu=temperature.gpu,utilization.gpu', '--format=csv,noheader,nounits',
    ]);
    const [temp, util] = stdout.trim().split(',').map((s) => Number(s.trim()));
    return { tempC: temp, utilPercent: util };
  } catch {
    return null; // no GPU / nvidia-smi unavailable -- not an error, just omit
  }
}

export async function getHostHealth() {
  const [cpu, mem, disk, net, gpu] = await Promise.all([
    getCpuPercent().catch(() => null),
    getMemPercent().catch(() => null),
    getDiskPercent().catch(() => null),
    getNetworkThroughputKbps().catch(() => null),
    getGpuStats().catch(() => null),
  ]);
  return { cpu, mem, disk, net, gpu, interface: NETWORK_INTERFACE };
}
