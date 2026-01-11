const STORAGE_KEY = "provocations_settings_v1";

const DEFAULT_SETTINGS = {
  provider: "gemini",
  model: "gemini-3-flash",
  apiKey: "",
  autoOn: true,
  autoGenerate: false,
  inputMode: "frames",
  frameIntervalSec: 5,
  maxFrames: 6,
  maxProvocations: 12,
  maxTranscriptChars: 12000
};

async function loadDevSettings() {
  try {
    const url = chrome.runtime.getURL("dev_settings.json");
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || typeof data !== "object") return null;
    if (data.provider !== "gemini") return null;
    if (typeof data.model !== "string" || !data.model) return null;
    if (typeof data.apiKey !== "string" || !data.apiKey) return null;
    return data;
  } catch {
    return null;
  }
}

async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  if (stored) return stored;
  const dev = await loadDevSettings();
  return dev ?? DEFAULT_SETTINGS;
}

function asText(err) {
  return err?.message ?? String(err);
}

async function geminiGenerateContent({ apiKey, model, contents, generationConfig }) {
  if (!apiKey) throw new Error("Missing API key. Set it in extension options.");
  if (!model) throw new Error("Missing model name. Set it in extension options.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: generationConfig ?? {
        temperature: 0.6,
        maxOutputTokens: 1024
      }
    })
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data?.error?.message ?? `HTTP ${resp.status}`;
    throw new Error(`Gemini error: ${msg}`);
  }
  return data;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "provocations:getSettings") {
        sendResponse({ ok: true, settings: await getSettings() });
        return;
      }

      if (message?.type === "provocations:generate") {
        const senderUrl = _sender?.url ?? "";
        const allowed =
          senderUrl.startsWith("https://www.youtube.com/watch") || senderUrl.startsWith("https://m.youtube.com/watch");
        if (!allowed) throw new Error("Generate requests are only allowed from YouTube watch pages.");

        const settings = await getSettings();
        if (settings.provider !== "gemini") throw new Error(`Unsupported provider: ${settings.provider}`);
        const data = await geminiGenerateContent({
          apiKey: settings.apiKey,
          model: settings.model,
          contents: message.payload.contents,
          generationConfig: message.payload.generationConfig
        });
        sendResponse({ ok: true, data });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      sendResponse({ ok: false, error: asText(err) });
    }
  })();

  return true;
});
