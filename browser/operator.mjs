#!/usr/bin/env node
// SOC Homelab browser operator: the one entry point for the persistent
// browser daemon. Handles first-time manual login, opens named views (see
// lib/pages.mjs), and takes screenshots on request. Never reads or prints
// cookies, tokens, or credentials.
//
// The daemon model exists because Kibana/Elastic's session cookie does not
// survive a full browser restart (Security Onion's own session does) --
// see lib/browser.mjs for the full explanation. So there is one long-running
// browser process ("the daemon"); everything else attaches to it.
//
// Usage:
//   node operator.mjs --daemon --wait-login       start the daemon (headed), wait for manual login if needed, then keep running
//   node operator.mjs --status                      report login state of the running daemon (or start one headless to check)
//   node operator.mjs --view overview --screenshot   attach to the daemon and open one view
//   node operator.mjs --all --screenshot             attach to the daemon and open every known view, each its own tab
//
// Flags:
//   --daemon        start (or become) the long-running browser process; implies --headed and stays running
//   --headed        show the browser window (default: headless, unless --daemon)
//   --wait-login    if not logged in, wait for the user to log in manually
//   --view <name>   navigate a tab to one named view
//   --all           open every VIEW_ORDER entry as its own tab
//   --screenshot    save a screenshot per navigated view to browser/artifacts/
//   --status        just report logged-in yes/no (for --view's target, or overview) and exit
import {
  openOrAttach,
  activePage,
  isLoggedIn,
  waitForManualLogin,
  isDaemonRunning,
  findOrCreateTab,
  ARTIFACTS_DIR,
  timestamp,
} from './lib/browser.mjs';
import { VIEWS, VIEW_ORDER, BASE } from './lib/pages.mjs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { daemon: false, headed: false, waitLogin: false, view: null, all: false, screenshot: false, status: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--daemon') args.daemon = true;
    else if (a === '--headed') args.headed = true;
    else if (a === '--wait-login') args.waitLogin = true;
    else if (a === '--view') args.view = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '--screenshot') args.screenshot = true;
    else if (a === '--status') args.status = true;
    else {
      console.error(`Onbekende vlag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function screenshotFor(page, name) {
  const file = path.join(ARTIFACTS_DIR, `${name}-${timestamp()}.png`);
  await page.screenshot({ path: file });
  return file;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.daemon && !(await isDaemonRunning())) {
    console.log('Geen actieve Security Onion Operator-daemon gevonden.');
    console.log('Start die eerst met: node operator.mjs --daemon --wait-login');
    console.log('(of via de "Security Onion Operator"-launcher)');
    process.exit(1);
  }

  const headed = args.daemon ? true : args.headed;
  const { context, attached } = await openOrAttach({ headless: !headed });
  const page = await activePage(context);

  // Only the process that owns the browser (didn't attach to an existing
  // one) may close it. Attached callers just stop using it and exit.
  let closing = false;
  const cleanShutdown = async (signal) => {
    if (closing || attached) return;
    closing = true;
    console.log(`\n${signal} ontvangen -- browser netjes sluiten...`);
    await context.close().catch(() => {});
    console.log('Browser gesloten.');
    process.exit(0);
  };
  if (!attached) {
    process.on('SIGTERM', () => cleanShutdown('SIGTERM'));
    process.on('SIGINT', () => cleanShutdown('SIGINT'));
  }

  const startUrl = args.view ? (VIEWS[args.view] ?? `${BASE}/`) : `${BASE}/`;
  // networkidle, not domcontentloaded: Kibana/Elastic pages show a
  // transient "Loading Elastic" splash with neither login nor app content
  // visible yet -- checking too early gives a false "logged in" reading.
  await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => {
    console.error(`Kan ${startUrl} niet bereiken: ${e.message}`);
  });
  await page.waitForTimeout(1500); // settle margin past networkidle

  let loggedIn = await isLoggedIn(page);

  if (args.status) {
    console.log(loggedIn ? 'INGELOGD' : 'NIET INGELOGD');
    if (!attached) await context.close();
    process.exit(loggedIn ? 0 : 1);
  }

  if (!loggedIn && args.waitLogin) {
    console.log(`Niet ingelogd. Er is nu een browservenster geopend op de inlogpagina (${startUrl}).`);
    console.log('Log alsjeblieft handmatig in -- ik wacht (tot 10 minuten).');
    loggedIn = await waitForManualLogin(page);
    console.log(loggedIn ? 'Login gedetecteerd. Sessie is actief.' : 'Time-out: nog steeds niet ingelogd na 10 minuten.');
  } else if (!loggedIn) {
    console.log('Niet ingelogd, en --wait-login is niet gegeven. Start opnieuw met --wait-login om handmatig in te loggen.');
  } else {
    console.log('Al ingelogd -- bestaande sessie is nog geldig.');
  }

  if (loggedIn && (args.view || args.all)) {
    const names = args.all ? VIEW_ORDER : [args.view];
    for (const name of names) {
      const url = VIEWS[name];
      if (!url) {
        console.error(`Onbekende view: ${name} (bekend: ${Object.keys(VIEWS).join(', ')})`);
        continue;
      }
      // Reuse an existing tab for this view rather than piling up
      // duplicates every time the operator/launcher is run again.
      const { page: tab, reused } = await findOrCreateTab(context, url, {
        reuseFirst: name === names[0] ? page : undefined,
      });
      await tab.bringToFront();
      await tab.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => {
        console.error(`${name}: navigatie mislukt -- ${e.message}`);
      });
      await tab.waitForTimeout(1000); // settle margin, matters for screenshots
      console.log(`${name}: ${reused ? 'hergebruikt' : 'geopend'} (${url})`);
      if (args.screenshot) {
        const file = await screenshotFor(tab, name);
        console.log(`${name}: screenshot opgeslagen -- ${file}`);
      }
    }
  }

  if (args.daemon && !attached) {
    console.log('Daemon actief en blijft draaien. Sluit het venster zelf, of stop dit proces om te stoppen.');
    await new Promise(() => {}); // keep this process (and the browser) alive
  } else if (args.daemon) {
    // --daemon was requested but one was already running elsewhere -- this
    // process doesn't own it, so report status and exit rather than hang
    // around forever doing nothing (e.g. the launcher clicked twice).
    console.log('Er draait al een daemon; dit proces sluit weer af (niets nieuws gestart).');
  }

  if (attached) {
    // Detach without closing the shared browser. A lingering CDP
    // WebSocket handle can otherwise keep the event loop alive
    // indefinitely, so force the process to actually exit.
    process.exit(0);
  }
  await context.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Onverwachte fout:', err.message);
  process.exit(1);
});
