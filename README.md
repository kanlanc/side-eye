# Provocations (YouTube) — Chrome Extension

YouTube-only Chrome extension that injects a lightweight side panel to:

- Generate **provocations** (thought-provoking critiques/questions) grounded in the video transcript.
- Chat about the video (also grounded in the transcript).

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
   - **Model name** (example placeholder: `gemini-3-flash`)

### Optional: BYOK via `.env` (dev convenience)

Chrome extensions can’t read your shell environment directly. For local development you can generate a file the extension can read:

1. Create `.env` from `.env.example`
2. Run `node scripts/generate-dev-settings.mjs` (writes `extension/dev_settings.json`)
3. Reload the extension in `chrome://extensions`

## Use on YouTube

- Go to any `youtube.com/watch?...` page.
- Click **Provocations** (top-right) to open the panel.
- Click **Refresh transcript** then **Generate**.

## Testing / debugging

- Reload the extension after changes: `chrome://extensions` → **Reload**
- On a YouTube video page:
  - Right-click → **Inspect** to see the content script logs
  - `chrome://extensions` → “Provocations (YouTube)” → **service worker** → **Inspect** to see Gemini/network errors
- Quick sanity checks:
  - Pick a video with captions, click **Refresh transcript**, confirm “Transcript loaded…”
  - Click **Generate**, confirm cards appear and **Jump** seeks the video
  - Switch to **Chat**, ask a question and confirm it answers from transcript (not generic)

## Notes / limitations

- This uses YouTube caption tracks (transcripts). If a video has no captions, the extension will not generate anything.
- The model is not given a URL and cannot “watch” the video by itself; it only sees the transcript text we extract.

## Video-first mode (no captions required)

In **Extension options**, set **Input mode** to:
- `Video frames (recommended)` to generate from live frames captured from the `<video>` element.
- `Video frames + transcript` to use both when captions are available.
