# Provocations (YouTube) — Chrome Extension

YouTube-only Chrome extension that injects a lightweight side panel to:

- Generate **provocations** (thought-provoking critiques/questions) grounded in video **frames** (transcript optional).
- Chat about the video grounded in frames + your running context (transcript optional).

## Load it in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder in this repo

## Configure Gemini

1. In `chrome://extensions`, open **Details** for “Provocations (YouTube)”
2. Click **Extension options**
3. Set:
   - **API key**
   - **Background model (structured)** (example: `gemini-3-flash`)
   - **Live model (low-latency)** (example: `gemini-2.5-flash-native-audio-preview-12-2025`)
   - (Optional) **Enable Google Search grounding** for richer background context

### Optional: BYOK via `.env` (dev convenience)

Chrome extensions can’t read your shell environment directly. For local development you can generate a file the extension can read:

1. Create `.env` from `.env.example`
2. Run `node scripts/generate-dev-settings.mjs` (writes `extension/dev_settings.json`)
3. Reload the extension in `chrome://extensions`

## Use on YouTube

- Go to any `youtube.com/watch?...` page.
- Click **Provocations** (top-right) to open the panel.
- Click **Generate** (frames are used by default; transcript is optional).

### Build context (recommended)

- Open the **Context** tab:
  - Wait ~1 minute for the running summary to start filling in, or click **Summarize now**
  - Use **Quick scan** to sample the video timeline (it scrubs the video and returns you back)

## Testing / debugging

- Reload the extension after changes: `chrome://extensions` → **Reload**
- On a YouTube video page:
  - Right-click → **Inspect** to see the content script logs
  - `chrome://extensions` → “Provocations (YouTube)” → **service worker** → **Inspect** to see Gemini/network errors
- Quick sanity checks:
  - Click **Generate**, confirm cards appear and **Jump** seeks the video
  - Switch to **Chat**, ask a question and confirm it responds (look for `[provocations]` logs on failures)

## Notes / limitations

- The model cannot “watch a YouTube URL” by itself; it only sees what we provide (frames + optional transcript).
- Some videos may require starting playback once before duration-based features (like Quick scan) work reliably.

## Video-first mode (no captions required)

In **Extension options**, set **Input mode** to:
- `Video frames (recommended)` to generate from live frames captured from the `<video>` element.
- `Video frames + transcript` to use both when captions are available.
