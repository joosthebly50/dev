// Live active-connection list for the Bazzite host itself (not Security
// Onion/Suricata data) -- `ss -tnp`, parsed. Shows PID + process name for
// every socket this user owns, which in practice is everything on a
// single-user desktop. No sudo needed: `ss` only hides PID/process for
// sockets owned by OTHER users, and there aren't any here.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

function parseSsLine(line) {
  // Example line:
  // ESTAB 0 0  192.168.50.254:41130   192.168.50.30:443  users:(("chrome",pid=155305,fd=29))
  const parts = line.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const [state, , , local, peer, ...rest] = parts;
  const [localAddr, localPort] = splitAddrPort(local);
  const [peerAddr, peerPort] = splitAddrPort(peer);

  const procText = rest.join(' ');
  const m = procText.match(/\(\("([^"]+)",pid=(\d+),fd=(\d+)\)\)/);
  const process = m ? m[1] : null;
  const pid = m ? Number(m[2]) : null;

  return { state, localAddr, localPort, peerAddr, peerPort, process, pid };
}

function splitAddrPort(s) {
  // IPv6 addresses are bracketed ([::1]:port); IPv4/plain are addr:port.
  const m = s.match(/^\[(.+)\]:(\d+)$/) || s.match(/^(.+):(\d+)$/);
  return m ? [m[1], m[2]] : [s, ''];
}

async function ssConnections(proto) {
  try {
    const { stdout } = await execFileP('ss', [`-${proto}np`]);
    return stdout
      .split('\n')
      .slice(1) // header row
      .filter(Boolean)
      .map((l) => ({ ...parseSsLine(l), proto: proto === 'tn' ? 'tcp' : 'udp' }))
      .filter((c) => c && c.localAddr);
  } catch {
    return [];
  }
}

const LAB_SUBNET = '192.168.50.';

export async function getActiveConnections() {
  const [tcp, udp] = await Promise.all([ssConnections('tn'), ssConnections('un')]);
  const all = [...tcp, ...udp];
  // Lab-network connections first (most relevant to a SOC dashboard),
  // then everything else, newest-looking (highest port, usually most
  // recently opened ephemeral connection) first within each group.
  all.sort((a, b) => {
    const aLab = a.localAddr.startsWith(LAB_SUBNET) || a.peerAddr.startsWith(LAB_SUBNET);
    const bLab = b.localAddr.startsWith(LAB_SUBNET) || b.peerAddr.startsWith(LAB_SUBNET);
    if (aLab !== bLab) return aLab ? -1 : 1;
    return Number(b.localPort) - Number(a.localPort);
  });
  return all;
}
