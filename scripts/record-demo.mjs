import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const OUT_DIR = join(ROOT, "demo");
const OUT_FILE = join(OUT_DIR, "crm-import-rescue-demo.webm");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const APP_URL = "http://localhost:4173/tool.html";
const WIDTH = 1440;
const HEIGHT = 900;

await mkdir(OUT_DIR, { recursive: true });

const port = 9223;
const profileDir = join(OUT_DIR, `.chrome-profile-${Date.now()}`);

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    APP_URL,
  ],
  { stdio: "ignore" },
);

try {
  const wsUrl = await waitForWebSocketUrl(port);
  const cdp = await connectCdp(wsUrl);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send("Page.navigate", { url: APP_URL });
  await waitForLoad(cdp);
  await sleep(600);

  const scenes = [];
  scenes.push({
    caption: "CRM Import Rescue turns a messy contact CSV into an import-ready CRM file.",
    image: await screenshot(cdp),
  });

  await evaluate(
    cdp,
    `
    document.querySelector("#presetSelect").value = "salesforce";
    document.querySelector("#presetSelect").dispatchEvent(new Event("change", { bubbles: true }));
    window.scrollTo({ top: 0 });
  `,
  );
  await sleep(300);
  scenes.push({
    caption: "Switch export targets for HubSpot, Salesforce, or Airtable.",
    image: await screenshot(cdp),
  });

  await evaluate(
    cdp,
    `
    document.querySelector("#fieldMapping").closest(".section-panel").scrollIntoView({ block: "start" });
  `,
  );
  await sleep(300);
  scenes.push({
    caption: "Review how messy source columns map into required CRM fields.",
    image: await screenshot(cdp),
  });

  await evaluate(
    cdp,
    `
    document.querySelector("#crmReadiness").closest(".section-panel").scrollIntoView({ block: "center" });
  `,
  );
  await sleep(300);
  scenes.push({
    caption:
      "Catch import blockers before upload: bad emails, duplicate contacts, and missing fields.",
    image: await screenshot(cdp),
  });

  await evaluate(
    cdp,
    `
    document.querySelector("#previewTable").closest(".section-panel").scrollIntoView({ block: "start" });
  `,
  );
  await sleep(300);
  scenes.push({
    caption: "Export a CRM-ready CSV and a client-ready cleanup report.",
    image: await screenshot(cdp),
  });

  const videoBase64 = await recordVideo(cdp, scenes);
  await writeFile(OUT_FILE, Buffer.from(videoBase64, "base64"));
  await cdp.close();
  console.log(OUT_FILE);
} finally {
  chrome.kill("SIGTERM");
  await waitForExit(chrome, 2500);
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}

async function waitForWebSocketUrl(port) {
  const url = `http://127.0.0.1:${port}/json/list`;
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find(
          (target) => target.type === "page" && target.webSocketDebuggerUrl,
        );
        if (page) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch {
      await sleep(100);
    }
    await sleep(100);
  }
  throw new Error("Chrome debugging endpoint did not start.");
}

function connectCdp(wsUrl) {
  return new Promise((resolveSocket, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const listeners = new Map();

    ws.addEventListener("open", () => {
      resolveSocket({
        send(method, params = {}) {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveCommand, rejectCommand) => {
            pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
          });
        },
        once(method) {
          return new Promise((resolveEvent) => {
            if (!listeners.has(method)) {
              listeners.set(method, []);
            }
            listeners.get(method).push(resolveEvent);
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message));
        } else {
          resolve(msg.result || {});
        }
      } else if (msg.method && listeners.has(msg.method)) {
        const list = listeners.get(msg.method);
        const listener = list.shift();
        if (listener) {
          listener(msg.params || {});
        }
      }
    });
    ws.addEventListener("error", reject);
  });
}

async function waitForLoad(cdp) {
  await cdp.once("Page.loadEventFired");
}

async function evaluate(cdp, expression, awaitPromise = false) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Evaluation failed.");
  }
  return result.result?.value;
}

async function screenshot(cdp) {
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  return result.data;
}

async function recordVideo(cdp, scenes) {
  const sceneJson = JSON.stringify(scenes);
  const expression = `
    (async () => {
      const scenes = ${sceneJson};
      document.body.innerHTML = "";
      document.body.style.margin = "0";
      document.body.style.background = "#10231f";
      const canvas = document.createElement("canvas");
      canvas.width = ${WIDTH};
      canvas.height = ${HEIGHT};
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const images = await Promise.all(scenes.map((scene) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = "data:image/png;base64," + scene.image;
      })));

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 3200000 });
      const chunks = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });

      function drawFrame(sceneIndex, localT, transition) {
        const img = images[sceneIndex];
        const zoom = 1 + localT * 0.018;
        const sw = ${WIDTH} / zoom;
        const sh = ${HEIGHT} / zoom;
        const sx = (${WIDTH} - sw) / 2;
        const sy = (${HEIGHT} - sh) / 2;
        ctx.fillStyle = "#10231f";
        ctx.fillRect(0, 0, ${WIDTH}, ${HEIGHT});
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, ${WIDTH}, ${HEIGHT});

        ctx.fillStyle = "rgba(16, 35, 31, 0.82)";
        roundRect(ctx, 36, ${HEIGHT} - 150, ${WIDTH} - 72, 104, 8);
        ctx.fill();
        ctx.fillStyle = "#80cbc4";
        ctx.font = "700 24px Inter, Arial, sans-serif";
        ctx.fillText("CRM Import Rescue", 66, ${HEIGHT} - 108);
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 34px Inter, Arial, sans-serif";
        wrapText(ctx, scenes[sceneIndex].caption, 66, ${HEIGHT} - 66, ${WIDTH} - 132, 39);

        if (transition > 0) {
          ctx.fillStyle = "rgba(16, 35, 31, " + transition.toFixed(4) + ")";
          ctx.fillRect(0, 0, ${WIDTH}, ${HEIGHT});
        }
      }

      function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
      }

      function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(" ");
        let line = "";
        for (const word of words) {
          const test = line ? line + " " + word : word;
          if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, y);
            line = word;
            y += lineHeight;
          } else {
            line = test;
          }
        }
        ctx.fillText(line, x, y);
      }

      recorder.start();
      const fps = 30;
      const framesPerScene = 84;
      const fadeFrames = 10;
      for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
        for (let frame = 0; frame < framesPerScene; frame++) {
          const localT = frame / framesPerScene;
          const fadeIn = frame < fadeFrames ? 1 - frame / fadeFrames : 0;
          const fadeOut = frame > framesPerScene - fadeFrames ? (frame - (framesPerScene - fadeFrames)) / fadeFrames : 0;
          drawFrame(sceneIndex, localT, Math.max(fadeIn, fadeOut));
          await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
        }
      }
      recorder.stop();
      await stopped;
      const blob = new Blob(chunks, { type: "video/webm" });
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    })()
  `;
  return evaluate(cdp, expression, true);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForExit(process, timeoutMs) {
  return new Promise((resolveDone) => {
    const timer = setTimeout(resolveDone, timeoutMs);
    process.once("exit", () => {
      clearTimeout(timer);
      resolveDone();
    });
  });
}
