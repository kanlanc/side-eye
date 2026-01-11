import fs from "node:fs/promises";
import path from "node:path";

function parseDotEnv(text) {
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function main() {
  const root = process.cwd();
  const envPath = path.join(root, ".env");
  const outPath = path.join(root, "extension", "dev_settings.json");

  const envText = await fs.readFile(envPath, "utf8").catch(() => {
    throw new Error("Missing .env. Create one from .env.example first.");
  });
  const env = parseDotEnv(envText);

  const apiKey = (env.GEMINI_API_KEY ?? "").trim();
  const model = (env.GEMINI_MODEL ?? "gemini-3-flash").trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is empty in .env");
  if (!model) throw new Error("GEMINI_MODEL is empty in .env");

  const devSettings = {
    provider: "gemini",
    model,
    liveModel: "gemini-2.5-flash-native-audio-preview-12-2025",
    apiKey,
    enableSearchGrounding: true,
    autoOn: true,
    autoGenerate: false,
    inputMode: "frames",
    frameIntervalSec: 1,
    maxFrames: 2,
    maxProvocations: 12,
    maxTranscriptChars: 12000
  };

  await fs.writeFile(outPath, JSON.stringify(devSettings, null, 2) + "\n", "utf8");
  process.stdout.write(`Wrote ${path.relative(root, outPath)}\n`);
}

main().catch((err) => {
  process.stderr.write((err?.message ?? String(err)) + "\n");
  process.exit(1);
});
