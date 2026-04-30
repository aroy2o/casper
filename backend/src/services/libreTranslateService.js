import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import axios from "axios";
import path from "node:path";
import { env } from "../config/env.js";

const LIBRE_URL = "http://127.0.0.1:8002";
const LIBRE_HOST = "127.0.0.1";
const LIBRE_PORT = "8002";
const MODELS = "en,hi,bn,te,ta,mr,gu,kn,pa,as,or,ur,ml,si,ne,fr,es,de,zh,ja,ar";
const DEFAULT_VENV_BIN = path.resolve(process.cwd(), "..", ".venv-libretranslate", "bin", "libretranslate");

const events = new EventEmitter();
let libreProcess;
let ready = false;
let restartAttempted = false;
let startupInFlight = false;
let stoppedByApp = false;
let lastLibreError = "";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probeReady = async () => {
  try {
    const response = await axios.get(`${LIBRE_URL}/languages`, { timeout: 1200 });
    return response.status === 200;
  } catch {
    return false;
  }
};

const watchForReady = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await probeReady()) {
      ready = true;
      events.emit("ready");
      return true;
    }
    await wait(500);
  }
  return false;
};

const spawnLibreTranslate = () => {
  // Prefer explicitly configured binary, then project-local venv binary, then PATH.
  const libreBin = env.LIBRETRANSLATE_BIN || DEFAULT_VENV_BIN;
  const args = ["--host", LIBRE_HOST, "--port", LIBRE_PORT, "--load-only", MODELS];
  console.log(`[LibreTranslate] Spawning: ${libreBin} ${args.join(" ")}`);
  const child = spawn(libreBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env }
  });

  child.stdout?.on("data", (chunk) => {
    const output = String(chunk);
    if (!ready && output.toLowerCase().includes("running on")) {
      void watchForReady();
    }
  });

  child.stderr?.on("data", (chunk) => {
    const output = String(chunk).trim();
    if (!output) return;
    lastLibreError = `${lastLibreError}\n${output}`.trim().slice(-4000);
    // keep logs concise but visible for startup failures
    console.error(`[LibreTranslate][stderr] ${output}`);
  });

  child.on("exit", (code, signal) => {
    const shouldRestart = !stoppedByApp && !restartAttempted;
    if (!stoppedByApp) {
      const reason = signal ? `signal=${signal}` : `code=${code}`;
      console.error(`[LibreTranslate] Process exited (${reason})`);
      if (lastLibreError) {
        console.error(`[LibreTranslate] Last error output:\n${lastLibreError}`);
      }
    }
    ready = false;
    libreProcess = undefined;
    if (shouldRestart) {
      restartAttempted = true;
      startupInFlight = false;
      void startLibreTranslate();
    }
  });

  child.on("error", (err) => {
    console.error(`[LibreTranslate] Failed to spawn process: ${err instanceof Error ? err.message : String(err)}`);
    ready = false;
  });

  return child;
};

export const startLibreTranslate = async () => {
  if (ready || startupInFlight) return;
  startupInFlight = true;
  stoppedByApp = false;

  try {
    lastLibreError = "";
    libreProcess = spawnLibreTranslate();
    const becameReady = await watchForReady();
    if (!becameReady) {
      ready = false;
      console.error("[LibreTranslate] Startup timeout: service did not become ready");
      if (lastLibreError) {
        console.error(`[LibreTranslate] Last error output:\n${lastLibreError}`);
      }
    }
  } catch {
    ready = false;
  } finally {
    startupInFlight = false;
  }
};

export const isLibreTranslateReady = () => ready;

export const stopLibreTranslate = async () => {
  stoppedByApp = true;
  ready = false;

  if (!libreProcess) return;

  await new Promise((resolve) => {
    const processRef = libreProcess;
    const timeout = setTimeout(() => {
      processRef.kill("SIGKILL");
      resolve(undefined);
    }, 2000);
    processRef.once("exit", () => {
      clearTimeout(timeout);
      resolve(undefined);
    });
    processRef.kill("SIGTERM");
  });
  libreProcess = undefined;
};

export const libreTranslateEvents = events;
