(() => {
  function pickCaptionTracks(playerResponse) {
    const tracks =
      playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ??
      playerResponse?.captions?.playerCaptionsRenderer?.captionTracks ??
      [];

    return tracks
      .map((t) => ({
        baseUrl: t.baseUrl,
        languageCode: t.languageCode,
        name: t.name?.simpleText ?? t.name?.runs?.map((r) => r.text).join("") ?? t.languageCode,
        kind: t.kind
      }))
      .filter((t) => typeof t.baseUrl === "string" && t.baseUrl.length > 0);
  }

  function getInitialPlayerResponse() {
    // YouTube sets one (or more) of these depending on rollout / navigation.
    const direct = window.ytInitialPlayerResponse ?? window.ytInitialPlayerResponseWithDetails ?? null;
    if (direct) return direct;

    // Older / alternate path: ytplayer.config.args.player_response is a JSON string.
    const pr = window.ytplayer?.config?.args?.player_response ?? window.ytplayer?.config?.args?.raw_player_response ?? null;
    if (typeof pr === "string" && pr.trim().startsWith("{")) {
      try {
        return JSON.parse(pr);
      } catch {
        return null;
      }
    }
    if (pr && typeof pr === "object") return pr;

    return null;
  }

  function post(type, payload) {
    window.postMessage({ source: "provocations", type, payload }, window.location.origin);
  }

  function send() {
    const player = getInitialPlayerResponse();
    const tracks = pickCaptionTracks(player);
    post("provocations:captionTracks", { tracks });
  }

  send();

  // SPA navigations can replace the response; retry a few times.
  let tries = 0;
  const interval = setInterval(() => {
    tries += 1;
    send();
    if (tries >= 10) clearInterval(interval);
  }, 1000);
})();
