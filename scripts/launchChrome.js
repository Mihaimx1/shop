// Launch a local Chrome instance that the tests can attach to over CDP.
const { spawn, execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

function getChromePath() {
  const platform = os.platform();

  if (platform === 'win32') {
    const possiblePaths = [
      process.env.CHROME_PATH,
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ].filter(Boolean);

    for (const candidatePath of possiblePaths) {
      if (fs.existsSync(candidatePath)) {
        console.log(`Chrome found at: ${candidatePath}`);
        return candidatePath;
      }
    }

    throw new Error('Chrome was not found. Set CHROME_PATH to the browser executable.');
  }

  if (platform === 'linux') {
    try {
      return execSync('which google-chrome').toString().trim();
    } catch {
      try {
        return execSync('which chromium-browser').toString().trim();
      } catch {
        throw new Error('Chrome/Chromium not found in PATH');
      }
    }
  }

  if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

function getUserDataDir() {
  if (process.env.CHROME_PROFILE_DIR) {
    return path.resolve(process.env.CHROME_PROFILE_DIR);
  }

  if (process.env.CHROME_PROFILE_MODE === 'temporary') {
    return path.join(os.tmpdir(), `chrome-cdp-${Date.now()}`);
  }

  return path.join(os.homedir(), '.chipy-shop', 'chrome-profile');
}

function launchChrome(debugPort = 9222, url = 'https://dev.chipy.com/shop') {
  const chromePath = getChromePath();
  const userDataDir = getUserDataDir();
  fs.mkdirSync(path.dirname(userDataDir), { recursive: true });

  const args = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    url,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-extensions',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--disable-gpu',
    '--start-maximized',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
  ];

  console.log(`Starting Chrome from: ${chromePath}`);
  console.log(`Using profile directory: ${userDataDir}`);
  console.log(`Launch arguments: ${args.join(' ')}`);

  const proc = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  proc.unref();
  return proc;
}

module.exports = { launchChrome, getChromePath, getUserDataDir };
