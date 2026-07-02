const { launchChrome } = require('./launchChrome');
const { spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CDP_PORT = 9222;
const CDP_URL = `http://localhost:${CDP_PORT}`;

function getTestPath() {
  const shopTestsPath = path.join(__dirname, '..', 'tests', 'shop');

  if (fs.existsSync(shopTestsPath)) {
    return 'tests/shop';
  }

  return 'tests';
}

function waitForCDP(port = CDP_PORT, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const check = () => {
      const req = http.get(`http://localhost:${port}/json/version`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });

      req.on('error', retry);
      req.end();
    };

    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`CDP endpoint on port ${port} was not ready after ${timeout}ms`));
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });
}

function waitForEnter(prompt = 'Press Enter after you finish Cloudflare in Chrome...') {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }

    const reader = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    reader.question(`${prompt}\n`, () => {
      reader.close();
      resolve();
    });
  });
}

async function runTests() {
  const userArgs = process.argv.slice(2);
  const testArgs = userArgs.length > 0 ? userArgs : [getTestPath()];
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  const chromeProc = launchChrome(CDP_PORT);

  try {
    await waitForCDP(CDP_PORT);
    console.log('CDP endpoint is ready.');
    console.log('Chrome profile is persistent by default.');
    console.log('You can now pass Cloudflare in the opened Chrome window.');
    await waitForEnter();

    process.env.CDP_URL = CDP_URL;

    console.log(`Running tests: ${testArgs.join(' ')}`);
    const result = spawnSync(npxCommand, ['playwright', 'test', ...testArgs, '--workers=1'], {
      stdio: 'inherit',
      env: { ...process.env, CDP_URL },
    });

    if (result.status !== 0) {
      throw new Error(`Playwright exited with code ${result.status ?? 1}`);
    }

    console.log('Tests completed successfully.');
  } catch (error) {
    console.error('Test run failed:', error.message);
    process.exit(1);
  } finally {
    if (chromeProc && !chromeProc.killed) {
      chromeProc.kill();
      console.log('Chrome process stopped.');
    }
  }
}

runTests();
