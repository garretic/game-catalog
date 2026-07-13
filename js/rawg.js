/* rawg.js — RAWG API lookup + localStorage cache.
 * Exposes a global `RAWG` object. No build step, no modules.
 */
(function () {
  "use strict";

  var KEY_STORAGE = "gc_rawg_key";
  var CACHE_STORAGE = "gc_rawg_cache_v1";
  var API = "https://api.rawg.io/api/games";

  // In-memory mirror of the cache so we read/write once per session.
  var cache = loadCache();

  function loadCache() {
    try {
      return JSON.parse(localStorage.getItem(CACHE_STORAGE)) || {};
    } catch (e) {
      return {};
    }
  }

  var saveTimer = null;
  function saveCacheDebounced() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      try {
        localStorage.setItem(CACHE_STORAGE, JSON.stringify(cache));
      } catch (e) {
        // Quota exceeded or private mode — degrade silently.
      }
    }, 400);
  }

  function getKey() {
    return localStorage.getItem(KEY_STORAGE) || "";
  }
  function setKey(k) {
    if (k) localStorage.setItem(KEY_STORAGE, k.trim());
  }
  function clearKey() {
    localStorage.removeItem(KEY_STORAGE);
  }

  // Normalize a title into a stable cache key. Strips edition suffixes and
  // punctuation so "Zelda: A Link to the Past (SNES)" and variants collapse.
  function cacheKeyFor(title) {
    return String(title)
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/\b(hd|remaster(ed)?|remake|definitive|deluxe|edition|the game)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // Pick the best RAWG result: prefer an exact (normalized) name match,
  // else the first result (RAWG orders by relevance).
  function pickResult(results, wantKey) {
    if (!results || !results.length) return null;
    for (var i = 0; i < results.length; i++) {
      if (cacheKeyFor(results[i].name) === wantKey) return results[i];
    }
    return results[0];
  }

  function shape(g) {
    if (!g) return { miss: true };
    return {
      cover: g.background_image || "",
      genres: (g.genres || []).map(function (x) { return x.name; }),
      // RAWG search results don't include developers; released gives the year.
      year: g.released ? String(g.released).slice(0, 4) : "",
      rawgId: g.id || null,
      name: g.name || ""
    };
  }

  /**
   * Look up one game by title. Resolves to a data object (possibly {miss:true}).
   * Cached results (including misses) never hit the network again.
   */
  function lookup(title) {
    var ck = cacheKeyFor(title) || String(title).toLowerCase();
    if (cache[ck]) return Promise.resolve(cache[ck]);

    var key = getKey();
    if (!key) return Promise.resolve({ miss: true, noKey: true });

    var url =
      API +
      "?key=" + encodeURIComponent(key) +
      "&search=" + encodeURIComponent(title) +
      "&page_size=5&search_precise=true";

    return fetch(url)
      .then(function (r) {
        if (r.status === 401) throw new Error("bad-key");
        if (!r.ok) throw new Error("http-" + r.status);
        return r.json();
      })
      .then(function (data) {
        var chosen = pickResult(data.results, ck);
        var shaped = shape(chosen);
        cache[ck] = shaped;
        saveCacheDebounced();
        return shaped;
      })
      .catch(function (err) {
        // Don't cache transient failures (network / bad key) so a later run retries.
        return { miss: true, error: err.message };
      });
  }

  function clearCache() {
    cache = {};
    try { localStorage.removeItem(CACHE_STORAGE); } catch (e) {}
  }

  function cacheSize() {
    return Object.keys(cache).length;
  }

  window.RAWG = {
    lookup: lookup,
    getKey: getKey,
    setKey: setKey,
    clearKey: clearKey,
    clearCache: clearCache,
    cacheSize: cacheSize,
    cacheKeyFor: cacheKeyFor
  };
})();
