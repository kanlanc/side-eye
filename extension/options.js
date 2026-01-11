const STORAGE_KEY = "provocations_settings_v1";

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

async function loadSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (
    result[STORAGE_KEY] ?? {
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
    }
  );
}

async function saveSettings(next) {
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

function setStatus(text) {
  $("status").textContent = text;
  if (text) setTimeout(() => setStatus(""), 2500);
}

async function main() {
  const settings = await loadSettings();

  $("provider").value = settings.provider ?? "gemini";
  $("model").value = settings.model ?? "gemini-3-flash";
  $("apiKey").value = settings.apiKey ?? "";
  $("autoOn").checked = Boolean(settings.autoOn);
  $("autoGenerate").checked = Boolean(settings.autoGenerate);
  $("inputMode").value = settings.inputMode ?? "frames";
  $("frameIntervalSec").value = String(settings.frameIntervalSec ?? 5);
  $("maxFrames").value = String(settings.maxFrames ?? 6);
  $("maxProvocations").value = String(settings.maxProvocations ?? 12);
  $("maxTranscriptChars").value = String(settings.maxTranscriptChars ?? 12000);

  $("save").addEventListener("click", async () => {
    const frameIntervalSec = Number($("frameIntervalSec").value);
    const maxFrames = Number($("maxFrames").value);
    const maxProvocations = Number($("maxProvocations").value);
    const maxTranscriptChars = Number($("maxTranscriptChars").value);
    const next = {
      provider: $("provider").value,
      model: $("model").value.trim(),
      apiKey: $("apiKey").value.trim(),
      autoOn: $("autoOn").checked,
      autoGenerate: $("autoGenerate").checked,
      inputMode: $("inputMode").value,
      frameIntervalSec: Number.isFinite(frameIntervalSec) ? Math.min(30, Math.max(1, Math.floor(frameIntervalSec))) : 5,
      maxFrames: Number.isFinite(maxFrames) ? Math.min(12, Math.max(1, Math.floor(maxFrames))) : 6,
      maxProvocations: Number.isFinite(maxProvocations) ? Math.min(30, Math.max(3, Math.floor(maxProvocations))) : 12,
      maxTranscriptChars: Number.isFinite(maxTranscriptChars)
        ? Math.min(50000, Math.max(2000, Math.floor(maxTranscriptChars)))
        : 12000
    };
    await saveSettings(next);
    setStatus("Saved");
  });

  $("clear").addEventListener("click", async () => {
    const cur = await loadSettings();
    await saveSettings({ ...cur, apiKey: "" });
    $("apiKey").value = "";
    setStatus("API key cleared");
  });
}

main().catch((err) => {
  console.error(err);
  setStatus("Error: " + (err?.message ?? String(err)));
});
