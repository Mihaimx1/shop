const { exec } = require("child_process");
const http = require("http");
const launchChrome = require("./launchChrome");

async function runTests() {
  let chromeProcess;
  try {
    chromeProcess = await launchChrome();
    console.log("Waiting for Chrome CDP endpoint...");

    const cdpUrl = "http://localhost:9222/json/version";
    const timeout = 15000; // 15 seconds
    const interval = 1000; // Check every 1 second
    let elapsed = 0;

    while (elapsed < timeout) {
      try {
        await new Promise((resolve, reject) => {
          http.get(cdpUrl, (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`CDP endpoint returned status code ${res.statusCode}`));
            }
          }).on("error", reject);
        });
        console.log("Chrome CDP endpoint is ready.");
        break;
      } catch (error) {
        // console.log(`CDP not ready yet: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, interval));
        elapsed += interval;
      }
    }

    if (elapsed >= timeout) {
      throw new Error("Timeout waiting for Chrome CDP endpoint.");
    }

    process.env.CDP_URL = "http://localhost:9222";
    console.log("CDP_URL set to", process.env.CDP_URL);

    const testPath = process.argv[2] || "tests/"; // Default to all tests if no argument
    const playwrightCommand = `npx playwright test ${testPath} --workers=1`;

    console.log(`Running Playwright tests: ${playwrightCommand}`);
    const { stdout, stderr } = await new Promise((resolve, reject) => {
      exec(playwrightCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return reject(error);
        }
        resolve({ stdout, stderr });
      });
    });

    console.log(stdout);
    if (stderr) {
      console.error(stderr);
    }
  } catch (error) {
    console.error("Error during test execution:", error);
    process.exit(1);
  } finally {
    if (chromeProcess) {
      console.log("Closing Chrome...");
      // Forcibly kill the process group to ensure all child processes are terminated
      try {
        process.kill(-chromeProcess.pid, 'SIGKILL');
        console.log("Chrome closed.");
      } catch (e) {
        console.error("Error killing Chrome process:", e);
      }
    }
  }
}

runTests();
