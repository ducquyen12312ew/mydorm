const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let latestBackendPort = null;
let latestWebPort = null;
let printedBackendPort = null;
let printedWebPort = null;

function tryPrintReadyBanner() {
  if (!latestBackendPort || !latestWebPort) return;

  if (printedBackendPort === latestBackendPort && printedWebPort === latestWebPort) {
    return;
  }

  const firstPrint = printedBackendPort === null && printedWebPort === null;
  printedBackendPort = latestBackendPort;
  printedWebPort = latestWebPort;

  process.stdout.write(firstPrint ? '\n=== Development Services Ready ===\n' : '\n=== Development Services Updated ===\n');
  process.stdout.write(`Backend: http://localhost:${latestBackendPort}\n`);
  process.stdout.write(`Main EJS Site: http://localhost:${latestBackendPort}/\n`);
  process.stdout.write(`Student Portal (server): http://localhost:${latestBackendPort}/student/\n`);
  process.stdout.write(`DormFlow Student Dev (Vite): http://localhost:${latestWebPort}/\n`);
  process.stdout.write('Note: /dashboard on DormFlow requires student login; unauthenticated calls return 401.\n');
  process.stdout.write('===================================\n\n');
}

function processLine(prefix, line) {
  if (prefix === 'backend') {
    const backendMatch = line.match(/server listening on port\s+(\d+)/i);
    if (backendMatch) {
      latestBackendPort = Number(backendMatch[1]);
      tryPrintReadyBanner();
    }
  }

  if (prefix === 'web') {
    const webMatch = line.match(/http:\/\/localhost:(\d+)\/?/i);
    if (webMatch) {
      latestWebPort = Number(webMatch[1]);
      tryPrintReadyBanner();
    }
  }
}

function probePort(port, pathName) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: 'localhost',
        port,
        path: pathName,
        timeout: 900,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function fallbackResolveLinks() {
  if (!latestBackendPort) {
    let highestBackendPort = null;
    for (let p = 5000; p <= 5010; p += 1) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await probePort(p, '/health');
      if (ok) {
        highestBackendPort = p;
      }
    }
    if (highestBackendPort) latestBackendPort = highestBackendPort;
  }

  if (!latestWebPort) {
    let highestWebPort = null;
    for (let p = 5174; p <= 5190; p += 1) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await probePort(p, '/');
      if (ok) {
        highestWebPort = p;
      }
    }
    if (highestWebPort) latestWebPort = highestWebPort;
  }

  tryPrintReadyBanner();
}

function prefixWrite(prefix, data, stream = process.stdout) {
  const text = String(data);
  const normalized = text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');

  if (prefix === 'web') {
    const webMatches = [...normalized.matchAll(/localhost:(\d+)\/?/gi)];
    if (webMatches.length > 0) {
      latestWebPort = Number(webMatches[webMatches.length - 1][1]);
      tryPrintReadyBanner();
    }
  }

  if (prefix === 'backend') {
    const backendMatches = [...normalized.matchAll(/server listening on port\s+(\d+)/gi)];
    if (backendMatches.length > 0) {
      latestBackendPort = Number(backendMatches[backendMatches.length - 1][1]);
      tryPrintReadyBanner();
    }
  }

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    processLine(prefix, line);
    stream.write(`[${prefix}] ${line}\n`);
  }
}

function runScript(scriptName, prefix) {
  const child = spawn(`${npmCmd} run ${scriptName}`, {
    cwd: rootDir,
    env: process.env,
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => prefixWrite(prefix, chunk, process.stdout));
  child.stderr.on('data', (chunk) => prefixWrite(prefix, chunk, process.stderr));

  child.on('error', (error) => {
    prefixWrite(prefix, `Failed to start script ${scriptName}: ${error.message}`, process.stderr);
  });

  return child;
}

const children = [];

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const backend = runScript('start:backend', 'backend');
const web = runScript('student:web', 'web');
children.push(backend, web);

const fallbackTimer = setInterval(() => {
  if (printedBackendPort && printedWebPort) {
    clearInterval(fallbackTimer);
    return;
  }
  fallbackResolveLinks().catch(() => null);
}, 2000);

backend.on('exit', (code) => {
  clearInterval(fallbackTimer);
  if (code !== 0) {
    prefixWrite('backend', `Exited with code ${code}`, process.stderr);
    shutdown(code || 1);
  }
});

web.on('exit', (code) => {
  clearInterval(fallbackTimer);
  if (code !== 0) {
    prefixWrite('web', `Exited with code ${code}`, process.stderr);
    shutdown(code || 1);
  }
});
