(function (global) {
  if (global.WLSearch) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { global.WLSearch.mount(document); });
    } else {
      global.WLSearch.mount(document);
    }
    return;
  }

  var INDEX_URL = "/search/search-index.json";
  var SEARCH_PAGE = "/search/";
  var LIMIT = 8;
  var PAGE_LIMIT = 40;
  var indexPromise = null;
  var indexData = null;

  function loadIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = fetch(INDEX_URL, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("search index missing");
        return res.text();
      })
      .then(function (text) {
        var data = JSON.parse(text);
        indexData = Array.isArray(data) ? data : data.pages || [];
        return indexData;
      })
      .catch(function () {
        indexPromise = null;
        indexData = [];
        return indexData;
      });
    return indexPromise;
  }

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/[^a-z0-9&]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokens(query) {
    return norm(query).split(" ").filter(function (part) {
      return part.length >= 2 || /^\d+$/.test(part);
    });
  }

  function fieldScore(field, term) {
    if (!field) return 0;
    if (field === term) return 40;
    if (field.startsWith(term + " ")) return 28;
    var idx = field.indexOf(term);
    if (idx === -1) return 0;
    if (idx === 0) return 22;
    if (field.charAt(idx - 1) === " ") return 16;
    return 10;
  }

  function scoreEntry(entry, terms, raw) {
    var title = norm(entry.title);
    var keywords = norm((entry.keywords || []).join(" "));
    var desc = norm(entry.desc);
    var section = norm(entry.section);
    var url = norm(entry.url);
    var hay = title + " " + keywords + " " + desc + " " + section + " " + url;
    var score = 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      if (hay.indexOf(term) === -1) return 0;
      score += fieldScore(title, term) * 3;
      score += fieldScore(keywords, term) * 2;
      score += fieldScore(desc, term);
      score += fieldScore(section, term);
      if (url.indexOf(term) !== -1) score += 6;
    }
    if (raw && title.indexOf(raw) !== -1) score += 24;
    if (raw && title === raw) score += 40;
    return score;
  }

  function search(query, limit) {
    var raw = norm(query);
    var terms = tokens(query);
    if (!terms.length || !indexData) return [];
    var ranked = [];
    for (var i = 0; i < indexData.length; i++) {
      var entry = indexData[i];
      var score = scoreEntry(entry, terms, raw);
      if (score > 0) ranked.push({ entry: entry, score: score });
    }
    ranked.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.title.localeCompare(b.entry.title);
    });
    return ranked.slice(0, limit || LIMIT);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function highlight(text, terms) {
    var safe = escapeHtml(text);
    if (!terms || !terms.length) return safe;
    var pattern = terms
      .slice()
      .sort(function (a, b) { return b.length - a.length; })
      .map(function (term) {
        return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("|");
    if (!pattern) return safe;
    return safe.replace(new RegExp("(" + pattern + ")", "gi"), "<mark>$1</mark>");
  }

  function closePanel(box) {
    var input = box.querySelector(".wl-search-input");
    var results = box.querySelector(".wl-search-results");
    box.classList.remove("is-open");
    if (results) {
      results.hidden = true;
      results.innerHTML = "";
    }
    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
  }

  function optionId(results, index) {
    return (results.id || "wlSearchResults") + "-opt-" + index;
  }

  function renderDropdown(box, query, hits) {
    var results = box.querySelector(".wl-search-results");
    var input = box.querySelector(".wl-search-input");
    if (!results || !input) return;
    var terms = tokens(query);
    if (!query.trim()) {
      closePanel(box);
      return;
    }
    box.classList.add("is-open");
    input.setAttribute("aria-expanded", "true");
    if (!hits.length) {
      results.hidden = false;
      results.innerHTML = '<div class="wl-search-empty" role="status">No results</div>' +
        '<a class="wl-search-all" href="' + SEARCH_PAGE + "?q=" + encodeURIComponent(query.trim()) + '">Search the full site</a>';
      return;
    }
    var html = hits.map(function (hit, index) {
      var entry = hit.entry;
      var section = entry.section ? '<span class="wl-search-section">' + escapeHtml(entry.section) + "</span>" : "";
      return '<a class="wl-search-hit" role="option" id="' + optionId(results, index) +
        '" href="' + escapeHtml(entry.url) + '" data-index="' + index + '">' +
        section +
        '<span class="wl-search-title">' + highlight(entry.title, terms) + "</span>" +
        (entry.desc ? '<span class="wl-search-desc">' + highlight(entry.desc, terms) + "</span>" : "") +
        "</a>";
    }).join("");
    html += '<a class="wl-search-all" href="' + SEARCH_PAGE + "?q=" + encodeURIComponent(query.trim()) +
      '">See all results</a>';
    results.innerHTML = html;
    results.hidden = false;
  }

  function activeHit(box) {
    var results = box.querySelector(".wl-search-results");
    if (!results) return null;
    return results.querySelector(".wl-search-hit.is-active");
  }

  function moveActive(box, delta) {
    var results = box.querySelector(".wl-search-results");
    var input = box.querySelector(".wl-search-input");
    if (!results || results.hidden) return;
    var hits = Array.prototype.slice.call(results.querySelectorAll(".wl-search-hit"));
    if (!hits.length) return;
    var current = hits.findIndex(function (el) { return el.classList.contains("is-active"); });
    var next = current + delta;
    if (next < 0) next = hits.length - 1;
    if (next >= hits.length) next = 0;
    hits.forEach(function (el) { el.classList.remove("is-active"); });
    hits[next].classList.add("is-active");
    if (input) input.setAttribute("aria-activedescendant", hits[next].id);
    hits[next].scrollIntoView({ block: "nearest" });
  }

  function bindBox(box) {
    if (box.getAttribute("data-wl-search-bound") === "1") return;
    box.setAttribute("data-wl-search-bound", "1");
    var form = box.querySelector(".wl-search-form");
    var input = box.querySelector(".wl-search-input");
    var timer = null;
    if (!input) return;

    function run() {
      var query = input.value;
      loadIndex().then(function () {
        if (input.value !== query) return;
        renderDropdown(box, query, search(query, LIMIT));
      });
    }

    input.addEventListener("focus", function () {
      loadIndex().then(function () {
        if (input.value.trim()) run();
      });
    });
    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(run, 120);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(box, 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(box, -1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closePanel(box);
        input.blur();
        var tools = box.closest(".wl-header-tools");
        if (tools) tools.classList.remove("is-search-open");
        var toggle = document.getElementById("wlSearchToggle");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      } else if (event.key === "Enter") {
        var current = activeHit(box);
        if (current) {
          event.preventDefault();
          global.location.href = current.getAttribute("href");
        }
      }
    });
    if (form) {
      form.addEventListener("submit", function (event) {
        var current = activeHit(box);
        if (current) {
          event.preventDefault();
          global.location.href = current.getAttribute("href");
        }
      });
    }
  }

  function bindToggle(root) {
    var toggle = root.querySelector("#wlSearchToggle");
    var tools = root.querySelector(".wl-header-tools");
    var box = root.querySelector(".wl-header-tools > .wl-search");
    if (!toggle || !tools || !box) return;
    if (toggle.getAttribute("data-wl-search-bound") === "1") return;
    toggle.setAttribute("data-wl-search-bound", "1");
    toggle.addEventListener("click", function (event) {
      event.preventDefault();
      var open = !tools.classList.contains("is-search-open");
      tools.classList.toggle("is-search-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      var input = box.querySelector(".wl-search-input");
      if (open && input) {
        loadIndex();
        input.focus();
      } else {
        closePanel(box);
      }
    });
  }

  function bindPage() {
    var form = document.querySelector("[data-wl-search-page]");
    if (!form || form.getAttribute("data-wl-search-bound") === "1") return;
    form.setAttribute("data-wl-search-bound", "1");
    var input = document.getElementById("wlSearchPageInput");
    var results = document.getElementById("wlSearchPageResults");
    var status = document.getElementById("wlSearchPageStatus");
    if (!input || !results) return;

    function paint(query) {
      var hits = search(query, PAGE_LIMIT);
      var terms = tokens(query);
      var q = query.trim();
      if (!q) {
        if (status) status.textContent = "Type a topic, tool or question — for example, Roth conversion, Medicare, or rent vs buy.";
        results.innerHTML = "";
        return;
      }
      if (!hits.length) {
        if (status) status.textContent = "No results for “" + q + "”.";
        results.innerHTML = '<p class="wl-search-page-empty">Try a shorter word, or browse the <a href="/retirement/">Retirement</a>, <a href="/real-estate/">Real Estate</a> or <a href="/money/">Money &amp; Lifestyle</a> hubs.</p>';
        return;
      }
      if (status) status.textContent = hits.length + (hits.length === 1 ? " result" : " results") + " for “" + q + "”.";
      results.innerHTML = hits.map(function (hit) {
        var entry = hit.entry;
        return '<a class="wl-search-page-hit" href="' + escapeHtml(entry.url) + '">' +
          (entry.section ? '<span class="wl-search-section">' + escapeHtml(entry.section) + "</span>" : "") +
          "<strong>" + highlight(entry.title, terms) + "</strong>" +
          (entry.desc ? "<span>" + highlight(entry.desc, terms) + "</span>" : "") +
          "</a>";
      }).join("");
    }

    function fromUrl() {
      var params = new URLSearchParams(global.location.search);
      var query = params.get("q") || "";
      input.value = query;
      loadIndex().then(function () { paint(query); });
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var query = input.value.trim();
      var url = SEARCH_PAGE + (query ? "?q=" + encodeURIComponent(query) : "");
      if (global.history && global.history.replaceState) {
        global.history.replaceState(null, "", url);
      }
      loadIndex().then(function () { paint(query); });
    });
    input.addEventListener("input", function () {
      var query = input.value;
      loadIndex().then(function () {
        if (input.value !== query) return;
        paint(query);
      });
    });
    fromUrl();
  }

  function onDocumentClick(event) {
    var target = event.target;
    document.querySelectorAll("[data-wl-search]").forEach(function (box) {
      if (box.contains(target)) return;
      var tools = box.closest(".wl-header-tools");
      if (tools && tools.contains(target)) return;
      closePanel(box);
    });
    if (!target.closest(".wl-header-tools")) {
      var openTools = document.querySelector(".wl-header-tools.is-search-open");
      if (openTools) {
        openTools.classList.remove("is-search-open");
        var toggle = document.getElementById("wlSearchToggle");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
    }
  }

  function mount(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-wl-search]").forEach(bindBox);
    bindToggle(scope);
    bindPage();
  }

  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    document.querySelectorAll("[data-wl-search]").forEach(closePanel);
    var tools = document.querySelector(".wl-header-tools.is-search-open");
    if (tools) {
      tools.classList.remove("is-search-open");
      var toggle = document.getElementById("wlSearchToggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }
  });

  global.WLSearch = {
    mount: mount,
    search: search,
    loadIndex: loadIndex
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mount(document); });
  } else {
    mount(document);
  }
})(window);
