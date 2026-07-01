const { exec, spawn } = require('child_process');
const os = require('os');

async function launchChrome() {
  const platform = os.platform();
  let chromePath;
  let userDataDir;

  if (platform === 'win32') {
    // Windows
    const programFiles = process.env['ProgramFiles(x86)'] || process.env.ProgramFiles;
    chromePath = `${programFiles}\\Google\\Chrome\\Application\\chrome.exe`;
    userDataDir = 'C:\\Temp\\chrome-cdp';
  } else if (platform === 'linux') {
    // Linux
    try {
      const { stdout } = await new Promise((resolve, reject) => {
        exec('which google-chrome', (error, stdout, stderr) => {
          if (error) reject(error);
          resolve({ stdout, stderr });
        });
      });
      chromePath = stdout.trim();
    } catch (e) {
      console.warn('google-chrome not found, trying chromium');
      try {
        const { stdout } = await new Promise((resolve, reject) => {
          exec('which chromium-browser', (error, stdout, stderr) => {
            if (error) reject(error);
            resolve({ stdout, stderr });
          });
        });
        chromePath = stdout.trim();
      } catch (e) {
        console.error('Neither google-chrome nor chromium-browser found.');
        throw e;
      }
    }
    userDataDir = '/tmp/chrome-cdp';
  } else if (platform === 'darwin') {
    // macOS
    chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    userDataDir = '/tmp/chrome-cdp';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const args = [
    `--remote-debugging-port=9222`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-dev-shm-usage',
    '--disable-domain-reliability',
    '--disable-features=site-per-process',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-notifications',
    '--disable-offer-store-unmasked-wallet-cards',
    '--disable-popup-blocking',
    '--disable-print-preview',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-setuid-sandbox',
    '--disable-speech-api',
    '--disable-toggle-shortcut-windows',
    '--disable-translate',
    '--disable-windows10-custom-titlebar',
    '--enable-automation',
    '--force-color-profile=srgb',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-sandbox',
    '--no-zygote',
    '--safebrowsing-disable-auto-update',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--start-maximized',
  ];

  const chromeProcess = spawn(chromePath, args, { detached: true, stdio: 'ignore' });
  chromeProcess.unref(); // Allow the Node.js process to exit independently of the Chrome process

  console.log('Chrome launched');
  return chromeProcess;
}

module.exports = launchChrome;
