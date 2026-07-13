/* app.js — loads games.json, renders grid/table, handles sort/filter/search,
 * and drives RAWG enrichment. No build step, no modules.
 */
(function () {
  "use strict";

  var GAMES = [];        // canonical records (each gets an _id + _enriched)
  var view = "table";    // "grid" | "table"
  var enrichPending = 0;

  var el = {
    stats: document.getElementById("stats"),
    grid: document.getElementById("grid"),
    tableWrap: document.getElementById("tableWrap"),
    tbody: document.getElementById("tbody"),
    empty: document.getElementById("empty"),
    resultCount: document.getElementById("resultCount"),
    search: document.getElementById("search"),
    sort: document.getElementById("sort"),
    platform: document.getElementById("platform"),
    genre: document.getElementById("genre"),
    year: document.getElementById("year"),
    gridBtn: document.getElementById("gridViewBtn"),
    tableBtn: document.getElementById("tableViewBtn"),
    resetBtn: document.getElementById("resetBtn"),
    keyBtn: document.getElementById("keyBtn"),
    enrichBar: document.getElementById("enrichBar"),
    enrichText: document.getElementById("enrichText"),
    enrichFill: document.getElementById("enrichFill")
  };

  // ---- Helpers ----------------------------------------------------------

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // A game is "dated" only if it has a full ISO date. Year-only and blank
  // both count as undated for date-sorting (grouped at the bottom).
  function hasFullDate(g) {
    return /^\d{4}-\d{2}-\d{2}$/.test(g.date || "");
  }

  function displayDate(g) {
    if (hasFullDate(g)) return g.date;
    if (g.date) return g.date;      // year-only string like "2017"
    return "—";
  }

  // Effective studio/year/genres = user data first, RAWG fallback.
  function studioOf(g) { return g.studio || (g._rawg && g._rawg.studio) || ""; }
  // Release year comes from RAWG. The games.json "year" field is completion-
  // derived (duplicates the Completed column), so it is NOT used here.
  function yearOf(g) {
    return (g._rawg && g._rawg.year) || "";
  }
  function genresOf(g) { return (g._rawg && g._rawg.genres) || []; }

  function stars(r) {
    var n = parseFloat(r);
    if (!n) return "";
    return "★".repeat(Math.round(n)) + "☆".repeat(Math.max(0, 5 - Math.round(n)));
  }

  // ---- Load -------------------------------------------------------------

  fetch("games.json")
    .then(function (r) {
      if (!r.ok) throw new Error("Could not load games.json (" + r.status + ")");
      return r.json();
    })
    .then(function (data) {
      GAMES = data.map(function (g, i) {
        g._id = i;
        g._rawg = null;
        return g;
      });
      buildFilterOptions();
      renderStats();
      wireEvents();
      render();
      startEnrichment();
    })
    .catch(function (err) {
      el.grid.innerHTML =
        '<p class="empty">' + esc(err.message) +
        '. If opening the file directly, run a local server instead ' +
        '(see README).</p>';
    });

  // ---- Filter option population ----------------------------------------

  function buildFilterOptions() {
    var platforms = {};
    GAMES.forEach(function (g) {
      if (g.platform) platforms[g.platform] = true;
    });
    fillSelect(el.platform, Object.keys(platforms).sort(), "All");
    refreshYearOptions();
  }

  // Release years come from RAWG, so this fills progressively as data loads.
  function refreshYearOptions() {
    var current = el.year.value;
    var set = {};
    GAMES.forEach(function (g) {
      var y = yearOf(g);
      if (y) set[y] = true;
    });
    var years = Object.keys(set).sort(function (a, b) { return b - a; });
    fillSelect(el.year, years, "All");
    // Bucket for entries with no known release year (RAWG miss / no match).
    var opt = document.createElement("option");
    opt.value = "__unknown__";
    opt.textContent = "Unknown";
    el.year.appendChild(opt);
    if (current && (set[current] || current === "__unknown__")) el.year.value = current;
  }

  // Genre dropdown fills progressively as RAWG data arrives.
  function refreshGenreOptions() {
    var current = el.genre.value;
    var set = {};
    GAMES.forEach(function (g) {
      genresOf(g).forEach(function (name) { set[name] = true; });
    });
    fillSelect(el.genre, Object.keys(set).sort(), "All");
    if (current && set[current]) el.genre.value = current;
  }

  function fillSelect(select, values, allLabel) {
    select.innerHTML = "";
    var all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel;
    select.appendChild(all);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select.appendChild(o);
    });
  }

  // ---- Header stats -----------------------------------------------------

  function renderStats() {
    var total = GAMES.length;
    var thisYear = new Date().getFullYear();
    var thisYearCount = 0;
    var platformCounts = {};
    var minD = null, maxD = null;

    GAMES.forEach(function (g) {
      if (g.platform) platformCounts[g.platform] = (platformCounts[g.platform] || 0) + 1;
      if (hasFullDate(g)) {
        if (g.date.slice(0, 4) === String(thisYear)) thisYearCount++;
        if (!minD || g.date < minD) minD = g.date;
        if (!maxD || g.date > maxD) maxD = g.date;
      }
    });

    var topPlatforms = Object.keys(platformCounts)
      .sort(function (a, b) { return platformCounts[b] - platformCounts[a]; });

    var range = (minD && maxD)
      ? minD.slice(0, 4) + "–" + maxD.slice(0, 4)
      : "—";

    var parts = [
      stat(total, "finished"),
      stat(thisYearCount, "in " + thisYear),
      stat(topPlatforms.length, "platforms"),
      stat(range, "span")
    ];
    if (topPlatforms[0]) {
      parts.push(stat(platformCounts[topPlatforms[0]], "on " + topPlatforms[0]));
    }
    el.stats.innerHTML = parts.join("");
  }

  function stat(value, label) {
    return '<span class="stat"><b>' + esc(value) + "</b>" + esc(label) + "</span>";
  }

  // ---- Filtering + sorting ---------------------------------------------

  function currentList() {
    var q = el.search.value.trim().toLowerCase();
    var pf = el.platform.value;
    var gn = el.genre.value;
    var yr = el.year.value;

    var list = GAMES.filter(function (g) {
      if (q && g.title.toLowerCase().indexOf(q) === -1) return false;
      if (pf && g.platform !== pf) return false;
      if (gn && genresOf(g).indexOf(gn) === -1) return false;
      if (yr) {
        if (yr === "__unknown__") { if (yearOf(g)) return false; }
        else if (yearOf(g) !== yr) return false;
      }
      return true;
    });

    return sortList(list, el.sort.value);
  }

  function sortList(list, mode) {
    var parts = mode.split("-");
    var field = parts[0], dir = parts[1] === "asc" ? 1 : -1;

    return list.slice().sort(function (a, b) {
      var r;
      switch (field) {
        case "title":
          r = a.title.localeCompare(b.title); break;
        case "year":
          r = numCmp(parseInt(yearOf(a), 10), parseInt(yearOf(b), 10)); break;
        case "rating":
          r = numCmp(parseFloat(a.rating), parseFloat(b.rating)); break;
        case "hours":
          r = numCmp(parseFloat(a.hours), parseFloat(b.hours)); break;
        case "date":
        default:
          // Undated always sinks to the bottom regardless of direction.
          var ad = hasFullDate(a), bd = hasFullDate(b);
          if (ad && !bd) return -1;
          if (!ad && bd) return 1;
          if (!ad && !bd) return a.title.localeCompare(b.title);
          r = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
          break;
      }
      if (r === 0) r = a.title.localeCompare(b.title);
      return field === "date" ? r * dir : r * dir;
    });
  }

  // NaN-safe numeric compare: missing values sort last (as smallest).
  function numCmp(a, b) {
    var an = isNaN(a), bn = isNaN(b);
    if (an && bn) return 0;
    if (an) return -1;
    if (bn) return 1;
    return a - b;
  }

  // ---- Render -----------------------------------------------------------

  function render() {
    var list = currentList();
    el.resultCount.textContent =
      list.length + (list.length === 1 ? " game" : " games") +
      (list.length !== GAMES.length ? " (of " + GAMES.length + ")" : "");

    var showEmpty = list.length === 0;
    el.empty.classList.toggle("hidden", !showEmpty);

    if (view === "grid") {
      el.grid.classList.toggle("hidden", showEmpty);
      el.tableWrap.classList.add("hidden");
      renderGrid(list);
    } else {
      el.tableWrap.classList.toggle("hidden", showEmpty);
      el.grid.classList.add("hidden");
      renderTable(list);
    }
  }

  function renderGrid(list) {
    var html = list.map(function (g) {
      // User-supplied "cover" URL wins over RAWG's.
      var cover = g.cover || (g._rawg && g._rawg.cover);
      var coverHtml = cover
        ? '<div class="cover"><img loading="lazy" src="' + esc(cover) +
          '" alt="" onerror="this.parentNode.classList.add(\'placeholder\');' +
          'this.parentNode.setAttribute(\'data-title\',this.alt);this.remove();"></div>'
        : '<div class="cover placeholder" data-title="' + esc(g.title) + '"></div>';

      var metaBits = [];
      if (g.platform) metaBits.push(esc(g.platform));
      var y = yearOf(g);
      if (y) metaBits.push(esc(y));

      var rating = g.rating
        ? '<span class="card-rating">' + stars(g.rating) + "</span>" : "";

      return (
        '<article class="card" title="' + esc(g.title) + '">' +
          '<div class="cover-wrap">' + coverHtml +
            (g.platform ? '<span class="badge">' + esc(g.platform) + "</span>" : "") +
          "</div>" +
          '<div class="card-body">' +
            '<div class="card-title">' + esc(g.title) + "</div>" +
            '<div class="card-meta">' +
              (studioOf(g) ? "<span>" + esc(studioOf(g)) + "</span>" : "") +
              (y ? "<span>" + esc(y) + "</span>" : "") +
            "</div>" +
            rating +
          "</div>" +
        "</article>"
      );
    }).join("");
    el.grid.innerHTML = html;
  }

  function renderTable(list) {
    el.tbody.innerHTML = list.map(function (g) {
      return (
        "<tr>" +
          '<td class="t-title">' + esc(g.title) + "</td>" +
          "<td>" + esc(studioOf(g) || "—") + "</td>" +
          "<td>" + esc(g.platform || "—") + "</td>" +
          "<td>" + esc(genresOf(g).join(", ") || "—") + "</td>" +
          "<td>" + esc(yearOf(g) || "—") + "</td>" +
          "<td>" + esc(displayDate(g)) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  // ---- Enrichment -------------------------------------------------------

  function startEnrichment() {
    var todo = GAMES.filter(function (g) {
      return !g.studio || !g.year || true; // always fetch cover; cache makes it cheap
    });
    enrichPending = todo.length;
    if (!RAWG.getKey()) {
      el.enrichBar.classList.remove("hidden");
      el.enrichText.innerHTML =
        'No RAWG key set — covers &amp; genres disabled. ' +
        '<a href="#" id="setKeyLink">Add key</a>';
      var link = document.getElementById("setKeyLink");
      if (link) link.addEventListener("click", function (e) {
        e.preventDefault(); promptForKey();
      });
      return;
    }
    el.enrichBar.classList.remove("hidden");
    runQueue(todo.slice(), todo.length);
  }

  // Sequential-with-small-concurrency queue to stay polite to the API.
  function runQueue(queue, total) {
    var CONCURRENCY = 4;
    var done = 0, active = 0, filtersDirty = false, filterTimer = null;

    function scheduleFilterRefresh() {
      filtersDirty = true;
      if (filterTimer) return;
      filterTimer = setTimeout(function () {
        filterTimer = null;
        if (filtersDirty) {
          filtersDirty = false;
          refreshGenreOptions();
          refreshYearOptions();
        }
      }, 600);
    }

    function tick() {
      while (active < CONCURRENCY && queue.length) {
        var g = queue.shift();
        active++;
        RAWG.lookup(g.title).then(function (res) {
          active--;
          done++;
          if (res && !res.miss) {
            g._rawg = {
              cover: res.cover,
              genres: res.genres,
              // Only use RAWG studio/year where the user's value is blank.
              studio: g.studio || "",
              year: res.year || ""
            };
            scheduleFilterRefresh();
          } else {
            g._rawg = { cover: "", genres: [], studio: "", year: "" };
          }
          updateEnrichBar(done, total);
          // Cheap incremental repaint of just this card's cover.
          patchCard(g);
          tick();
          if (done === total) finishEnrichment();
        }.bind(null));
      }
    }
    tick();
  }

  // Update one card's cover in place without a full re-render (grid view only).
  function patchCard(g) {
    if (view !== "grid" || !g._rawg || !g._rawg.cover) return;
    // Full re-render is simplest and cheap at this scale; debounce it.
    scheduleRender();
  }

  var renderTimer = null;
  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(function () {
      renderTimer = null;
      render();
    }, 300);
  }

  function updateEnrichBar(done, total) {
    var pct = total ? Math.round((done / total) * 100) : 100;
    el.enrichFill.style.width = pct + "%";
    el.enrichText.textContent =
      "Enriching from RAWG… " + done + " / " + total;
  }

  function finishEnrichment() {
    refreshGenreOptions();
    refreshYearOptions();
    render();
    el.enrichText.textContent =
      "Enrichment complete (" + RAWG.cacheSize() + " cached).";
    setTimeout(function () { el.enrichBar.classList.add("hidden"); }, 2500);
  }

  // ---- Key management ---------------------------------------------------

  function promptForKey() {
    var current = RAWG.getKey();
    var k = window.prompt(
      "Enter your free RAWG API key (from rawg.io/apidocs).\n" +
      "Stored only in this browser's localStorage.",
      current
    );
    if (k === null) return;         // cancelled
    if (k.trim() === "") { RAWG.clearKey(); return; }
    RAWG.setKey(k);
    RAWG.clearCache();              // re-fetch with the new key
    GAMES.forEach(function (g) { g._rawg = null; });
    startEnrichment();
  }

  // ---- Events -----------------------------------------------------------

  function wireEvents() {
    var reRender = debounce(render, 120);
    el.search.addEventListener("input", reRender);
    el.sort.addEventListener("change", render);
    el.platform.addEventListener("change", render);
    el.genre.addEventListener("change", render);
    el.year.addEventListener("change", render);

    el.gridBtn.addEventListener("click", function () { setView("grid"); });
    el.tableBtn.addEventListener("click", function () { setView("table"); });

    el.resetBtn.addEventListener("click", function () {
      el.search.value = "";
      el.sort.value = "date-desc";
      el.platform.value = "";
      el.genre.value = "";
      el.year.value = "";
      render();
    });

    el.keyBtn.addEventListener("click", promptForKey);

    // Clickable table headers -> sort.
    Array.prototype.forEach.call(
      document.querySelectorAll("#table thead th"),
      function (th) {
        th.addEventListener("click", function () {
          var f = th.getAttribute("data-sort");
          var cur = el.sort.value.split("-");
          var dir = (cur[0] === f && cur[1] === "asc") ? "desc" : "asc";
          // Sensible default directions.
          if (cur[0] !== f) dir = (f === "date" || f === "rating" || f === "hours" || f === "year") ? "desc" : "asc";
          el.sort.value = f + "-" + dir;
          markSortedHeader(f, dir);
          render();
        });
      }
    );
  }

  function markSortedHeader(field, dir) {
    Array.prototype.forEach.call(
      document.querySelectorAll("#table thead th"),
      function (th) {
        var on = th.getAttribute("data-sort") === field;
        th.classList.toggle("sorted", on);
        th.classList.toggle("asc", on && dir === "asc");
      }
    );
  }

  function setView(v) {
    view = v;
    el.gridBtn.classList.toggle("active", v === "grid");
    el.tableBtn.classList.toggle("active", v === "table");
    el.gridBtn.setAttribute("aria-pressed", v === "grid");
    el.tableBtn.setAttribute("aria-pressed", v === "table");
    render();
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }
})();
