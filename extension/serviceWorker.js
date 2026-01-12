const STORAGE_KEY = "provocations_settings_v1";

const DEFAULT_SETTINGS = {
  provider: "gemini",
  model: "gemini-3-flash",
  deepModel: "gemini-3-pro-preview",
  liveModel: "gemini-3-flash",
  apiKey: "",
  enableSearchGrounding: true,
  autoOn: true,
  autoGenerate: true,
  inputMode: "youtube_url",
  frameIntervalSec: 1,
  maxFrames: 2,
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
  if (stored && typeof stored === "object") return { ...DEFAULT_SETTINGS, ...stored };
  const dev = await loadDevSettings();
  if (dev && typeof dev === "object") return { ...DEFAULT_SETTINGS, ...dev };
  return DEFAULT_SETTINGS;
}

function asText(err) {
  return err?.message ?? String(err);
}

function normalizeGenerationConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return undefined;
  const inCfg = cfg;
  const out = { ...inCfg };

  function mapKey(from, to) {
    if (!Object.prototype.hasOwnProperty.call(inCfg, from)) return;
    if (!Object.prototype.hasOwnProperty.call(inCfg, to)) out[to] = inCfg[from];
    delete out[from];
  }

  mapKey("candidate_count", "candidateCount");
  mapKey("max_output_tokens", "maxOutputTokens");
  mapKey("top_p", "topP");
  mapKey("top_k", "topK");
  mapKey("presence_penalty", "presencePenalty");
  mapKey("frequency_penalty", "frequencyPenalty");
  mapKey("response_mime_type", "responseMimeType");
  mapKey("response_schema", "responseSchema");

  return out;
}

function normalizePart(part) {
  const p = part && typeof part === "object" ? { ...part } : {};

  if (p.inline_data && !p.inlineData) {
    const d = p.inline_data && typeof p.inline_data === "object" ? { ...p.inline_data } : {};
    if (d.mime_type && !d.mimeType) d.mimeType = d.mime_type;
    delete d.mime_type;
    p.inlineData = d;
    delete p.inline_data;
  }

  if (p.file_data && !p.fileData) {
    const d = p.file_data && typeof p.file_data === "object" ? { ...p.file_data } : {};
    if (d.mime_type && !d.mimeType) d.mimeType = d.mime_type;
    if (d.file_uri && !d.fileUri) d.fileUri = d.file_uri;
    delete d.mime_type;
    delete d.file_uri;
    p.fileData = d;
    delete p.file_data;
  }

  if (p.inlineData && typeof p.inlineData === "object") {
    if (p.inlineData.mime_type && !p.inlineData.mimeType) p.inlineData.mimeType = p.inlineData.mime_type;
    delete p.inlineData.mime_type;
  }
  if (p.fileData && typeof p.fileData === "object") {
    if (p.fileData.mime_type && !p.fileData.mimeType) p.fileData.mimeType = p.fileData.mime_type;
    if (p.fileData.file_uri && !p.fileData.fileUri) p.fileData.fileUri = p.fileData.file_uri;
    delete p.fileData.mime_type;
    delete p.fileData.file_uri;
  }

  return p;
}

function normalizeContents(contents) {
  if (!Array.isArray(contents)) return contents;
  return contents.map((c) => {
    if (!c || typeof c !== "object") return c;
    if (!Array.isArray(c.parts)) return c;
    return { ...c, parts: c.parts.map(normalizePart) };
  });
}

async function geminiGenerateContent({ apiKey, model, contents, tools, generationConfig }) {
  if (!apiKey) throw new Error("Missing API key. Set it in extension options.");
  if (!model) throw new Error("Missing model name. Set it in extension options.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      contents: normalizeContents(contents),
      tools,
      generationConfig: normalizeGenerationConfig(generationConfig) ?? {
        temperature: 0.6,
        maxOutputTokens: 1024
      }
    })
  }).catch((err) => {
    if (controller.signal.aborted) throw new Error("Gemini request timed out.");
    throw err;
  });
  clearTimeout(timeout);

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data?.error?.message ?? `HTTP ${resp.status}`;
    throw new Error(`Gemini error: ${msg}`);
  }
  return data;
}

async function geminiStreamGenerateContentToTab({
  apiKey,
  model,
  contents,
  tools,
  generationConfig,
  tabId,
  requestId
}) {
  if (!tabId) throw new Error("Missing tabId for streaming");
  if (!apiKey) throw new Error("Missing API key. Set it in extension options.");
  if (!model) throw new Error("Missing model name. Set it in extension options.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: normalizeContents(contents),
      tools,
      generationConfig: normalizeGenerationConfig(generationConfig) ?? { temperature: 0.4, maxOutputTokens: 1024 }
    })
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Gemini stream error: HTTP ${resp.status} ${text}`.trim());
  }

  const decoder = new TextDecoder();
  const reader = resp.body.getReader();
  let buffered = "";
  let accumulated = "";

  async function send(payload) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "provocations:streamChunk", payload });
    } catch {
      // Tab might have navigated/closed; stop streaming.
      try {
        await reader.cancel();
      } catch {}
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });

    while (true) {
      const sep = buffered.indexOf("\n\n");
      if (sep < 0) break;
      const event = buffered.slice(0, sep);
      buffered = buffered.slice(sep + 2);

      const lines = event.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const dataStr = line.slice("data:".length).trim();
        if (!dataStr) continue;
        if (dataStr === "[DONE]") {
          await send({ requestId, done: true });
          return;
        }
        let json;
        try {
          json = JSON.parse(dataStr);
        } catch {
          continue;
        }
        const text =
          json?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
        if (!text) continue;

        // Heuristic: some streams send full text-so-far; others send deltas.
        let delta = text;
        if (accumulated && text.startsWith(accumulated)) {
          delta = text.slice(accumulated.length);
          accumulated = text;
        } else {
          accumulated += text;
        }
        if (delta) await send({ requestId, delta, done: false });
      }
    }
  }

  await send({ requestId, done: true });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (_sender?.id && _sender.id !== chrome.runtime.id) throw new Error("Blocked external sender");

      if (message?.type === "provocations:getSettings") {
        sendResponse({ ok: true, settings: await getSettings() });
        return;
      }

      if (message?.type === "provocations:generate") {
        const senderUrl = _sender?.url ?? "";
        const allowed =
          senderUrl.startsWith("https://www.youtube.com/watch") ||
          senderUrl.startsWith("https://youtube.com/watch") ||
          senderUrl.startsWith("https://m.youtube.com/watch");
        if (!allowed) throw new Error("Generate requests are only allowed from YouTube watch pages.");

        const settings = await getSettings();
        if (settings.provider !== "gemini") throw new Error(`Unsupported provider: ${settings.provider}`);

        const useSearchGrounding =
          settings.enableSearchGrounding && message?.payload?.disableSearchGrounding !== true;
        const tools = useSearchGrounding ? [{ google_search: {} }] : undefined;
        const model = message?.payload?.modelOverride ?? settings.model;
        const data = await geminiGenerateContent({
          apiKey: settings.apiKey,
          model,
          contents: message.payload.contents,
          tools,
          generationConfig: message.payload.generationConfig
        });
        sendResponse({ ok: true, data });
        return;
      }

      if (message?.type === "provocations:streamGenerate") {
        const senderUrl = _sender?.url ?? "";
        const allowed =
          senderUrl.startsWith("https://www.youtube.com/watch") ||
          senderUrl.startsWith("https://youtube.com/watch") ||
          senderUrl.startsWith("https://m.youtube.com/watch");
        if (!allowed) throw new Error("Stream requests are only allowed from YouTube watch pages.");

        const tabId = _sender?.tab?.id;
        const requestId = message?.payload?.requestId;
        if (!requestId) throw new Error("Missing requestId");

        const settings = await getSettings();
        if (settings.provider !== "gemini") throw new Error(`Unsupported provider: ${settings.provider}`);

        const useSearchGrounding =
          settings.enableSearchGrounding && message?.payload?.disableSearchGrounding !== true;
        const tools = useSearchGrounding ? [{ google_search: {} }] : undefined;

        // Ack immediately; stream updates will arrive via chrome.tabs.sendMessage.
        sendResponse({ ok: true });

        geminiStreamGenerateContentToTab({
          apiKey: settings.apiKey,
          model: settings.model,
          contents: message.payload.contents,
          tools,
          generationConfig: message.payload.generationConfig,
          tabId,
          requestId
        }).catch((err) => {
          chrome.tabs
            .sendMessage(tabId, {
              type: "provocations:streamChunk",
              payload: { requestId, error: asText(err), done: true }
            })
            .catch(() => {});
        });

        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      sendResponse({ ok: false, error: asText(err) });
    }
  })();

  return true;
});
