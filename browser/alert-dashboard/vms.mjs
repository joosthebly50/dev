// Live libvirt VM status for the SOC Alarmdashboard's VM panel -- shells
// out to `virsh list --all` on the Bazzite host itself (same pattern as
// health.mjs), no daemon/API needed since it's cheap to run per request.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

// ` ATTACK-Kali` has a genuine leading space in libvirt itself (a known
// quirk documented in NETWORK.md/SERVERS.md, previously the cause of a
// real bug in scripts matching on VM name) -- trimmed for display here,
// matched as-is against virsh's raw output.
const DISPLAY_NAMES = {
  'OPNsense-FW': 'OPNsense',
  'SOC-SecurityOnion': 'Security Onion',
  'ATTACK-Kali': 'Kali (Red)',
  'Target-Metasploitable2': 'Metasploitable2',
  'DC01': 'DC01 (AD)',
  'ubuntu-server-01': 'ubuntu-server-01',
  'WIN11-01': 'WIN11-01',
};

// Fixed display order (roughly infra -> targets), independent of whatever
// order virsh happens to list domains in.
const ORDER = [
  'OPNsense-FW', 'SOC-SecurityOnion', 'ATTACK-Kali',
  'DC01', 'WIN11-01', 'ubuntu-server-01', 'Target-Metasploitable2',
];

export async function getVmStatus() {
  const { stdout } = await execFileP('virsh', ['-c', 'qemu:///system', 'list', '--all']);
  const lines = stdout.split('\n').slice(2); // skip header + separator
  const vms = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Columns: Id Name... State... -- name can contain a leading space
    // (ATTACK-Kali) so split on 2+ spaces instead of single-space fields.
    const parts = trimmed.split(/\s{2,}/);
    if (parts.length < 2) continue;
    const name = parts[1].trim();
    const state = parts.slice(2).join(' ').trim() || parts[0];
    vms.push({ name, running: state === 'running', state });
  }
  vms.sort((a, b) => {
    const ai = ORDER.indexOf(a.name);
    const bi = ORDER.indexOf(b.name);
    return (ai === -1 ? ORDER.length : ai) - (bi === -1 ? ORDER.length : bi);
  });
  return vms.map((v) => ({ ...v, label: DISPLAY_NAMES[v.name] || v.name }));
}
