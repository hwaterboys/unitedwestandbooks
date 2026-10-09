/* United We Stand Books — site script (no dependencies, no build step) */
(function () {
  "use strict";

  var GENRES = {
    romance:  { label: "Romance",            filter: "Romance" },
    thriller: { label: "Thriller",           filter: "Thriller" },
    action:   { label: "Action & Adventure", filter: "Action" }
  };
  var SITE = "https://unitedwestandbooks.com";

  /* ---------- helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function icon(id, cls) { return '<svg class="' + (cls || "") + '" aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>'; }
  function params() { return new URLSearchParams(window.location.search); }

  /* ---------- analytics stub (SRS §12) ----------
     Pushes events to window.dataLayer. No analytics tool is installed yet,
     so nothing leaves the browser. Connect a privacy-conscious tool later. */
  window.dataLayer = window.dataLayer || [];
  function track(name, data) {
    var evt = Object.assign({ event: name, page_path: location.pathname, timestamp: new Date().toISOString() }, data || {});
    window.dataLayer.push(evt);
  }
  window.UWSB_track = track;

  /* ---------- data access ---------- */
  function allBooks() {
    var list = Array.isArray(window.UWSB_BOOKS) ? window.UWSB_BOOKS : [];
    return list.filter(function (b) { return b && b.status === "published" && GENRES[b.genre]; });
  }
  function findBook(slug) {
    if (!slug) return null;
    return allBooks().filter(function (b) { return b.slug === slug; })[0] || null;
  }
  function previewChapters(book) {
    return (book.chapters || []).filter(function (c) {
      return c.preview_enabled === true && c.status === "published" && Array.isArray(c.body) && c.body.length;
    }).sort(function (a, b) { return a.chapter_number - b.chapter_number; });
  }
  function fullOnlyChapters(book) {
    return (book.chapters || []).filter(function (c) {
      return c.status === "published" && c.preview_enabled !== true;
    }).sort(function (a, b) { return a.chapter_number - b.chapter_number; });
  }
  function validBuyUrl(book) {
    if (book.placeholder) return "#";
    try { var u = new URL(book.retailer_url); return u.protocol === "https:" ? u.href : null; } catch (e) { return null; }
  }
  function bookUrl(b) { return b.page_path || ("/books/book/?slug=" + encodeURIComponent(b.slug)); }
  function hasAuthor(b) { return !!(b.author && String(b.author).trim()); }
  function chLabel(c) { return c.label || ("Chapter " + c.chapter_number); }
  function readLabel(c) { return c.label === "Prologue" ? "the Prologue" : chLabel(c); }
  /* Title as shown on the cover: series small above, title large. Screen readers hear "Series: Title". */
  function titleHTML(b) {
    if (b.series && b.short_title) {
      return '<span class="t-series">' + esc(b.series) + '<span class="sr-only">: </span></span><span class="t-main">' + esc(b.short_title) + '</span>';
    }
    return esc(b.title);
  }
  /* Chapter paragraph: a string, or an array of strings and {i: "..."} italic runs (author's emphasis). */
  function runsHTML(runs) {
    if (!Array.isArray(runs)) return esc(runs);
    return runs.map(function (s) {
      if (s && typeof s === "object") return s.b != null ? "<strong>" + esc(s.b) + "</strong>" : "<em>" + esc(s.i) + "</em>";
      return esc(s);
    }).join("");
  }
  function plainText(p) { return Array.isArray(p) ? p.map(function (s) { return s && typeof s === "object" ? (s.i != null ? s.i : s.b) : s; }).join("") : String(p); }
  function paraHTML(para) {
    if (Array.isArray(para)) return "<p>" + runsHTML(para) + "</p>";
    return String(para).trim() === "***" ? '<p class="scene-break" aria-hidden="true">***</p>' : "<p>" + esc(para) + "</p>";
  }
  function draftTag(b) { return b.copy_status === "draft" ? ' <span class="draft-tag" title="Drafted for review; not yet approved by the author">Draft copy</span>' : ""; }
  /* Shown instead of a Buy button when a real book has no retailer link yet. */
  function soonHTML(b, variant) {
    if (b.placeholder || validBuyUrl(b)) return "";
    if (variant === "chip") return '<span class="soon-chip">' + icon("i-cart") + '<span>Full book coming soon</span></span>';
    return '<p class="soon-note">' + icon("i-info") + '<span><strong>Full book coming soon.</strong> A purchase link isn\u2019t available yet. Check back soon.</span></p>';
  }
  function chapterUrl(b, n) { return "/books/preview/?slug=" + encodeURIComponent(b.slug) + "&chapter=" + n; }
  function coverHTML(b, large, sizes) {
    if (b.cover_image) {
      var load = large ? ' fetchpriority="high"' : ' loading="lazy"';
      var img = '<img src="' + esc(b.cover_fallback || b.cover_image) + '" alt="' + esc(b.cover_alt) + '" width="600" height="900"' + load + ' decoding="async">';
      if (b.cover_srcset) {
        img = '<picture><source type="image/webp" srcset="' + esc(b.cover_srcset) + '" sizes="' + esc(sizes || (large ? "(max-width: 767px) 240px, 360px" : "170px")) + '">' + img + '</picture>';
      }
      return '<div class="cover' + (large ? " lg" : "") + '">' + img + '</div>';
    }
    return '<div class="cover gen' + (b.placeholder ? " placeholder" : "") + (large ? " lg" : "") + '" role="img" aria-label="' + esc(b.cover_alt || (b.title + " cover")) + '">' +
      icon("i-star", "c-star") +
      '<span class="c-title" aria-hidden="true">' + esc(b.title.replace(/\s*\(Placeholder\)\s*$/, "")) + '</span>' +
      '<span class="c-rule" aria-hidden="true"></span>' +
      (hasAuthor(b) ? '<span class="c-author" aria-hidden="true">' + esc(b.author) + '</span>' : "") +
      (b.placeholder ? '<span class="c-flag" aria-hidden="true">Placeholder</span>' : "") +
    '</div>';
  }
  function cleanBadge(b) {
    if (b.placeholder) return '<span class="badge badge-placeholder">Placeholder</span>';
    if (b.clean_review_status === "approved") return '<span class="badge badge-clean">' + icon("i-shield") + 'Clean-content reviewed</span>';
    return "";
  }
  function setMeta(title, desc, canonicalPath, noindex, image) {
    if (image) {
      var oi = $('meta[property="og:image"]'); if (oi) oi.setAttribute("content", SITE + image);
    }
    document.title = title;
    var d = $('meta[name="description"]'); if (d && desc) d.setAttribute("content", desc);
    var c = $('link[rel="canonical"]'); if (c && canonicalPath) c.setAttribute("href", SITE + canonicalPath);
    var ot = $('meta[property="og:title"]'); if (ot) ot.setAttribute("content", title);
    var od = $('meta[property="og:description"]'); if (od && desc) od.setAttribute("content", desc);
    var ou = $('meta[property="og:url"]'); if (ou && canonicalPath) ou.setAttribute("content", SITE + canonicalPath);
    if (noindex) {
      var m = document.createElement("meta"); m.name = "robots"; m.content = "noindex"; document.head.appendChild(m);
    }
  }

  /* ---------- global nav ---------- */
  function initNav() {
    var t = $(".nav-toggle"), nav = $("#site-nav");
    if (!t || !nav) return;
    t.addEventListener("click", function () {
      var open = t.getAttribute("aria-expanded") === "true";
      t.setAttribute("aria-expanded", String(!open));
      t.querySelector(".sr-only").textContent = open ? "Open menu" : "Close menu";
      nav.classList.toggle("is-open", !open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { t.click(); t.focus(); }
    });
  }

  function initCtaTracking() {
    $all("[data-cta]").forEach(function (a) {
      a.addEventListener("click", function () {
        track("click_primary_cta", { placement: a.getAttribute("data-cta"), destination: a.getAttribute("href") });
      });
    });
  }

  /* ---------- catalog ---------- */
  function initCatalog() {
    var root = $("#catalog"); if (!root) return;
    var grid = $("#book-grid"), count = $("#results-count"), empty = $("#empty-state"), none = $("#no-books-state");
    var input = $("#book-search"), clearBtn = $("#search-clear"), form = $("#search-form");
    var books = allBooks();
    var p = params();
    var state = { genre: GENRES[p.get("genre")] ? p.get("genre") : "all", q: (p.get("q") || "").slice(0, 100) };
    input.value = state.q;

    function syncUrl() {
      var u = new URLSearchParams();
      if (state.genre !== "all") u.set("genre", state.genre);
      if (state.q) u.set("q", state.q);
      var qs = u.toString();
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
    }
    function card(b) {
      var pc = previewChapters(b), g = GENRES[b.genre];
      var actions = pc.length
        ? '<a class="btn btn-primary btn-sm" href="' + chapterUrl(b, pc[0].chapter_number) + '" data-open-preview="' + esc(b.id) + '" data-ch="' + pc[0].chapter_number + '">' + icon("i-book") + 'Preview Chapters</a>'
        : '<p class="soon-inline">' + icon("i-info") + '<span>Preview chapters coming soon</span></p>';
      return '<li><article class="book-card">' +
        '<div class="cover-wrap">' + coverHTML(b) + '</div>' +
        '<div class="body">' +
          '<div class="meta"><span class="badge">' + esc(g.label) + '</span>' + cleanBadge(b) + '</div>' +
          '<h3><a href="' + bookUrl(b) + '">' + titleHTML(b) + '</a></h3>' +
          (b.tagline ? '<p class="tagline">' + esc(b.tagline) + '</p>' : "") +
          (hasAuthor(b) ? '<p class="author">by ' + esc(b.author) + '</p>' : "") +
          (b.hook ? '<p class="hook">' + esc(b.hook) + '</p>' : "") +
          '<div class="actions">' + actions + '</div>' +
        '</div></article></li>';
    }
    function render() {
      $all(".filter-btn").forEach(function (btn) { btn.setAttribute("aria-pressed", String(btn.dataset.genre === state.genre)); });
      clearBtn.classList.toggle("show", !!state.q);
      if (!books.length) {
        grid.innerHTML = ""; empty.hidden = true; none.hidden = false; count.textContent = "No titles published yet";
        return;
      }
      none.hidden = true;
      var q = state.q.trim().toLowerCase();
      var list = books.filter(function (b) {
        if (state.genre !== "all" && b.genre !== state.genre) return false;
        if (!q) return true;
        var hay = [b.title, b.subtitle, b.tagline, b.series, b.author, b.hook, (b.synopsis || []).map(plainText).join(" ")].join(" ").toLowerCase();
        return hay.indexOf(q) !== -1;
      });
      grid.innerHTML = list.map(card).join("");
      empty.hidden = list.length > 0;
      var gl = state.genre === "all" ? "" : " in " + GENRES[state.genre].label;
      count.textContent = list.length + (list.length === 1 ? " book" : " books") + gl + (state.q ? " matching \u201c" + state.q + "\u201d" : "");
      $all("[data-open-preview]", grid).forEach(function (a) {
        a.addEventListener("click", function () { track("open_preview", { book_id: a.getAttribute("data-open-preview"), chapter_number: parseInt(a.getAttribute("data-ch"), 10) }); });
      });
    }
    $all(".filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.genre = btn.dataset.genre; syncUrl(); render();
        track("filter_books", { genre: state.genre });
      });
    });
    var debounce;
    input.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () { state.q = input.value.slice(0, 100); syncUrl(); render(); }, 150);
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); state.q = input.value.slice(0, 100); syncUrl(); render();
      track("search_books", { query_length: state.q.length });
    });
    clearBtn.addEventListener("click", function () { input.value = ""; state.q = ""; syncUrl(); render(); input.focus(); });
    $all("[data-reset]").forEach(function (b) {
      b.addEventListener("click", function () { input.value = ""; state.q = ""; state.genre = "all"; syncUrl(); render(); input.focus(); });
    });
    render();
  }

  /* ---------- book detail ---------- */
  function notFound(container, what) {
    setMeta("Not Found | United We Stand Books", "This page could not be found.", null, true);
    container.innerHTML = '<div class="container"><div class="state-card">' + icon("i-book", "big") +
      '<h1>We couldn\u2019t find that ' + what + '.</h1><p>It may have moved, or it isn\u2019t published yet. Browse the catalog to find your next read.</p>' +
      '<div class="btn-row"><a class="btn btn-primary" href="/books/">Explore Books' + icon("i-arrow", "i-arrow") + '</a></div></div></div>';
  }
  function buyButton(b, cls, label) {
    var url = validBuyUrl(b);
    if (!url) return "";
    if (b.placeholder) {
      return '<a class="btn ' + cls + '" href="#" data-placeholder-buy aria-describedby="buy-ph-note">' + icon("i-cart") + (label || "Buy Full Book") + '<span class="ph-tag">Placeholder</span></a>';
    }
    var host = new URL(url).hostname.replace(/^www\./, "");
    return '<a class="btn ' + cls + '" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" data-buy="' + esc(b.id) + '" data-domain="' + esc(host) + '">' +
      icon("i-cart") + (label || "Buy Full Book") + icon("i-external") + '<span class="sr-only"> (opens ' + esc(host) + ' in a new tab)</span></a>';
  }
  function wireBuy(scope, b) {
    $all("[data-buy]", scope).forEach(function (a) {
      a.addEventListener("click", function () { track("click_purchase", { book_id: b.id, retailer_domain: a.getAttribute("data-domain") }); });
    });
    $all("[data-placeholder-buy]", scope).forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); });
    });
  }
  function initDetail() {
    var root = $("#book-detail"); if (!root) return;
    var b = findBook(params().get("slug") || root.getAttribute("data-slug"));
    if (!b) return notFound(root, "book");
    var g = GENRES[b.genre], pc = previewChapters(b), locked = fullOnlyChapters(b);
    var path = bookUrl(b);
    setMeta((b.seo_title || b.title) + (hasAuthor(b) ? " by " + b.author : "") + " | United We Stand Books", b.seo_description || b.hook, path, !!b.placeholder, b.og_image);
    track("view_book", { book_id: b.id, genre: b.genre });

    var buyUrl = validBuyUrl(b);
    var host = buyUrl && !b.placeholder ? new URL(buyUrl).hostname.replace(/^www\./, "") : "";
    var previewBtn = pc.length
      ? '<a class="btn btn-primary btn-lg" href="' + chapterUrl(b, pc[0].chapter_number) + '" data-open-preview>' + icon("i-book") + 'Read ' + readLabel(pc[0]) + ' Free</a>'
      : "";
    var facts = [["Genre", g.label], ["Series", b.series], ["Format", b.format], ["Release date", b.release_date], ["ISBN", b.isbn], ["Price", b.price_display]]
      .filter(function (f) { return f[1]; });

    var html =
      '<section class="detail-hero on-dark"><div class="container">' +
        '<div class="detail-grid">' +
          '<div class="detail-cover">' + coverHTML(b, true) + '</div>' +
          '<div class="detail-info">' +
            '<div class="badges"><span class="badge">' + esc(g.label) + '</span>' + cleanBadge(b) +
              (pc.length ? '<span class="badge">' + icon("i-eye") + pc.length + ' free preview chapter' + (pc.length === 1 ? "" : "s") + '</span>' : "") + '</div>' +
            '<h1 class="book-title">' + titleHTML(b) + '</h1>' +
            (b.subtitle ? '<p class="subtitle">' + esc(b.subtitle) + '</p>' : "") +
            (b.tagline ? '<p class="subtitle tagline">' + esc(b.tagline) + '</p>' : "") +
            (hasAuthor(b) ? '<p class="byline">by <strong>' + esc(b.author) + '</strong></p>' : "") +
            (b.hook && b.synopsis_status !== "approved" ? '<p class="hook">' + esc(b.hook) + draftTag(b) + '</p>' : "") +
            '<div class="cta-panel">' + previewBtn + buyButton(b, pc.length ? "btn-ghost btn-lg" : "btn-primary btn-lg") +
              (pc.length ? '<p class="preview-meta">' + icon("i-check") + 'Read ' + pc.length + ' chapter' + (pc.length === 1 ? "" : "s") + ' free. No account or email needed.</p>'
                         : '<p class="preview-meta no-preview">' + icon("i-info") + '<span><strong>Preview chapters coming soon.</strong> Free sample chapters for this title aren\u2019t available yet.</span></p>') +
              soonHTML(b) +
              (b.placeholder ? '<p class="ext-note" id="buy-ph-note">Placeholder: no retailer link is set up for this sample book, so Buy Full Book doesn\u2019t go anywhere.</p>'
                : (host ? '<p class="ext-note">Buy Full Book opens ' + esc(host) + ' in a new tab. Purchases are completed with that retailer.</p>' : "")) +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div></section>' +
      '<section class="section-tight"><div class="container detail-body">' +
        '<div class="main-col prose">' +
          '<h2>About the Book' + ((b.synopsis && b.synopsis.length && b.synopsis_status !== "approved") ? draftTag(b) : "") + '</h2>' +
          ((b.synopsis && b.synopsis.length) ? b.synopsis.map(function (p) { return "<p>" + runsHTML(p) + "</p>"; }).join("")
            : (b.tagline ? '<p>' + esc(b.tagline) + '.</p>' : "") + '<p class="muted">A full description is coming soon.</p>') +
          (pc.length || locked.length ? '<h2>Chapters</h2><ol class="chapter-list">' +
            pc.map(function (c) {
              return '<li><a href="' + chapterUrl(b, c.chapter_number) + '"><span><span class="num">' + (c.title === chLabel(c) ? "Free preview" : esc(chLabel(c)) + ' \u00b7 Free preview') + '</span><span class="ttl">' + esc(c.title) + '</span></span>' + icon("i-arrow") + '</a></li>';
            }).join("") +
            locked.map(function (c) {
              return '<li><div class="locked"><span><span class="num">' + esc(chLabel(c)) + ' \u00b7 In the full book</span><span class="ttl">' + esc(c.title) + '</span></span>' + icon("i-lock") + '</div></li>';
            }).join("") + '</ol>' : "") +
        '</div>' +
        '<aside class="side-col" aria-label="Book details">' +
          '<div class="notes-card"><h2>' + icon("i-shield") + 'Content Notes' + draftTag(b) + '</h2>' +
            ((b.clean_notes && b.clean_notes.length) ? '<ul>' + b.clean_notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + '</ul>' : (b.clean_notes_pending ? '<p class="muted">Content notes will be added once this title has been reviewed.</p>' : '<p class="muted">No content notes for this title.</p>')) +
            '<a class="text-link" href="/clean-book-promise/">Read our Clean-Content Standards' + icon("i-arrow") + '</a></div>' +
          '<div class="notes-card"><h2>' + icon("i-info") + 'Book Details</h2><dl class="facts">' +
            facts.map(function (f) { return "<dt>" + f[0] + "</dt><dd>" + esc(f[1]) + "</dd>"; }).join("") +
            (hasAuthor(b) ? '<dt>Author</dt><dd>' + esc(b.author) + '</dd>' : "") + '<dt>Free chapters</dt><dd>' + (pc.length ? pc.length : 'Coming soon') + '</dd>' +
            (!buyUrl && !b.placeholder ? '<dt>Full book</dt><dd>Coming soon</dd>' : "") + '</dl></div>' +
        '</aside>' +
      '</div></section>' +
      relatedHTML(b) +
      ((pc.length || buyUrl) ? '<div class="mobile-sticky-cta on-dark">' +
        (pc.length ? '<a class="btn btn-primary" href="' + chapterUrl(b, pc[0].chapter_number) + '">Read Free Chapters</a>' : "") +
        buyButton(b, pc.length ? "btn-ghost" : "btn-primary", "Buy Book") + '</div>' : "");

    root.innerHTML = html;
    wireBuy(root, b);
    $all("[data-open-preview]", root).forEach(function (a) {
      a.addEventListener("click", function () { track("open_preview", { book_id: b.id, chapter_number: pc[0].chapter_number }); });
    });

    if (!b.placeholder) {
      var ld = { "@context": "https://schema.org", "@type": "Book", name: b.title, genre: g.label, url: SITE + path, description: b.hook || b.tagline || b.seo_description };
      if (hasAuthor(b)) ld.author = { "@type": "Person", name: b.author };
      if (b.series) ld.isPartOf = { "@type": "BookSeries", name: b.series };
      if (b.isbn) ld.isbn = b.isbn;
      if (b.cover_image) ld.image = SITE + (b.cover_fallback || b.cover_image);
      var s = document.createElement("script"); s.type = "application/ld+json"; s.textContent = JSON.stringify(ld); document.head.appendChild(s);
    }
  }
  function relatedHTML(b) {
    var rel = allBooks().filter(function (x) { return x.genre === b.genre && x.slug !== b.slug; }).slice(0, 3);
    if (!rel.length) return "";
    return '<section class="section-tight section-tint"><div class="container"><h2>More ' + esc(GENRES[b.genre].label) + '</h2><ul class="book-grid">' +
      rel.map(function (r) {
        return '<li><article class="book-card"><div class="cover-wrap">' + coverHTML(r) + '</div><div class="body"><h3><a href="' + bookUrl(r) + '">' + titleHTML(r) + '</a></h3>' + (hasAuthor(r) ? '<p class="author">by ' + esc(r.author) + '</p>' : "") + '</div></article></li>';
      }).join("") + '</ul></div></section>';
  }

  /* ---------- chapter reader ---------- */
  function initReader() {
    var root = $("#reader"); if (!root) return;
    var p = params();
    var b = findBook(p.get("slug"));
    if (!b) return notFound(root, "book");
    var pc = previewChapters(b), locked = fullOnlyChapters(b);
    var rawN = p.get("chapter");
    var n = (rawN !== null && rawN !== "") ? parseInt(rawN, 10) : (pc[0] ? pc[0].chapter_number : 1);
    var idx = -1;
    pc.forEach(function (c, i) { if (c.chapter_number === n) idx = i; });

    var bar = $("#reader-bar");
    var titleBk = $(".reader-titles .bk"), titleCh = $(".reader-titles .ch"), back = $(".reader-back");
    back.setAttribute("href", bookUrl(b));
    titleBk.textContent = b.title;
    var barBuy = $("#bar-buy"); barBuy.outerHTML = buyButton(b, "btn-primary btn-sm") || soonHTML(b, "chip");

    if (idx === -1) {
      // Chapter not published as a preview (or doesn't exist): never render text.
      var isLocked = locked.some(function (c) { return c.chapter_number === n; });
      var lockedCh = locked.filter(function (c) { return c.chapter_number === n; })[0];
      titleCh.textContent = isLocked ? chLabel(lockedCh) + " is in the full book" : "Chapter not found";
      setMeta("Chapter Not Available | " + b.title, "This chapter is not part of the free preview.", null, true);
      $("#reader-main").innerHTML = '<div class="state-card">' + icon(isLocked ? "i-lock" : "i-book", "big") +
        '<h1>' + (isLocked ? "This chapter isn\u2019t part of the free preview." : "We couldn\u2019t find that chapter.") + '</h1>' +
        '<p>' + (pc.length ? "You can read " + pc.length + " chapter" + (pc.length === 1 ? "" : "s") + " of " + esc(b.title) + " free." : "Free preview chapters aren\u2019t available for this title yet.") + '</p>' +
        '<div class="btn-row">' + (pc.length ? '<a class="btn btn-primary" href="' + chapterUrl(b, pc[0].chapter_number) + '">Start ' + esc(readLabel(pc[0])) + '</a>' : "") +
        '<a class="btn btn-outline" href="' + bookUrl(b) + '">Back to Book</a></div></div>';
      $(".reader-layout").classList.add("single");
      $("#reader-index").hidden = true;
      wireBuy(document, b);
      return;
    }

    var ch = pc[idx], prev = pc[idx - 1], next = pc[idx + 1], isLast = !next;
    var headTitle = (ch.title === chLabel(ch) ? ch.title : chLabel(ch) + ": " + ch.title);
    setMeta(headTitle + " \u2013 " + b.title + " (Free Preview) | United We Stand Books",
      "Read " + readLabel(ch) + " of " + b.title + (hasAuthor(b) ? " by " + b.author : "") + " free. No account needed.", chapterUrl(b, ch.chapter_number), !!b.placeholder, b.og_image);
    titleCh.textContent = chLabel(ch) + " \u00b7 Preview " + (idx + 1) + " of " + pc.length;

    // Index
    var idxHTML = '<button class="index-toggle" type="button" aria-expanded="false" aria-controls="index-list">Chapters (' + (idx + 1) + ' of ' + pc.length + ' free)' + icon("i-arrow") + '</button>' +
      '<nav class="index-list" id="index-list" aria-label="Preview chapters"><h2>Free preview chapters</h2><ol>' +
      pc.map(function (c) {
        return '<li><a href="' + chapterUrl(b, c.chapter_number) + '"' + (c === ch ? ' aria-current="page"' : "") + '><span class="n">' + esc(chLabel(c)) + '</span>' + (c.title === chLabel(c) ? "" : esc(c.title)) + '</a></li>';
      }).join("") +
      locked.map(function (c) {
        return '<li><span class="locked"><span class="n">' + esc(chLabel(c)) + ' \u00b7 Full book</span>' + esc(c.title) + '</span></li>';
      }).join("") + '</ol></nav>' +
      (validBuyUrl(b) ? '<div class="side-buy"><p>Enjoying the story? The full book continues where the preview ends.</p>' + buyButton(b, "btn-primary btn-sm") + '</div>'
                      : '<div class="side-buy soon"><p><strong>Full book coming soon.</strong> A purchase link isn\u2019t available yet. For now, enjoy the free preview chapters.</p></div>');
    $("#reader-index").innerHTML = idxHTML;
    var tog = $(".index-toggle"), list = $("#index-list");
    tog.addEventListener("click", function () {
      var o = tog.getAttribute("aria-expanded") === "true";
      tog.setAttribute("aria-expanded", String(!o)); list.classList.toggle("open", !o);
    });

    // Body
    var body = ch.body.map(paraHTML).join("");
    var nav = '<nav class="chapter-nav" aria-label="Chapter navigation">' +
      (prev ? '<a class="prev" rel="prev" href="' + chapterUrl(b, prev.chapter_number) + '"><span class="lbl">' + icon("i-arrow") + 'Previous</span><span class="t">' + esc(prev.title) + '</span></a>'
            : '<a class="prev" href="' + bookUrl(b) + '"><span class="lbl">' + icon("i-arrow") + 'Back</span><span class="t">About this book</span></a>') +
      (next ? '<a class="next" rel="next" href="' + chapterUrl(b, next.chapter_number) + '" data-next><span class="lbl">Next' + icon("i-arrow") + '</span><span class="t">' + esc(next.title) + '</span></a>'
            : '<span class="next disabled" aria-disabled="true"><span class="lbl">End of preview</span><span class="t">Last free chapter</span></span>') +
      '</nav>';
    var hasBuy = !!validBuyUrl(b);
    var cont = isLast ? '<section class="continue-cta" aria-labelledby="continue-h">' +
        '<p class="eyebrow center">You\u2019ve reached the end of the free preview</p>' +
        '<h2 id="continue-h">Love what you have read? Continue the story.</h2>' +
        (hasBuy ? '<p>The rest of ' + esc(b.title) + ' is in the full book. Pick up right where you left off.</p>'
                : '<p>The rest of ' + esc(b.title) + ' is in the full book, which is coming soon. A purchase link isn\u2019t available yet, so check back soon.</p>') +
        '<div class="btn-row">' + (hasBuy ? buyButton(b, "btn-primary btn-lg") + '<a class="btn btn-ghost btn-lg" href="/books/">Browse More Books</a>'
                                          : '<a class="btn btn-primary btn-lg" href="' + bookUrl(b) + '">Back to the Book</a><a class="btn btn-ghost btn-lg" href="/books/">Browse More Books</a>') + '</div>' +
        (b.placeholder ? '<p class="ext-note mt-1">Placeholder: no retailer link is set up for this sample book.</p>' : "") +
      '</section>' : "";

    $("#reader-main").innerHTML = '<article class="chapter" aria-labelledby="ch-title"><div class="chapter-inner">' +
      '<header class="chapter-head">' + (ch.title === chLabel(ch) ? "" : '<p class="num">' + esc(chLabel(ch)) + '</p>') + '<h1 id="ch-title">' + esc(ch.title) + '</h1><div class="rule"></div>' +
      (ch.epigraph ? '<p class="epigraph">' + runsHTML(ch.epigraph) + '</p>' : "") +
      '<p class="chapter-sample-flag">' + (b.placeholder ? '<span class="badge badge-placeholder">Placeholder text</span>' : '<span class="badge">Free preview</span>') +
        '<span>' + esc(b.title) + (hasAuthor(b) ? ' \u00b7 ' + esc(b.author) : "") + '</span></p></header>' +
      '<div class="chapter-body" id="chapter-body">' + body + '</div>' + nav +
      '<p class="kbd-hint">Tip: use <kbd>\u2190</kbd> and <kbd>\u2192</kbd> to move between chapters.</p>' +
      cont + '</div></article>';

    var mb = $("#reader-mobile-buy");
    var mbHtml = buyButton(b, "btn-primary");
    if (mbHtml) mb.innerHTML = mbHtml; else mb.remove();

    wireBuy(document, b);
    var nx = $("[data-next]");
    if (nx) nx.addEventListener("click", function () { track("next_chapter", { book_id: b.id, chapter_number: next.chapter_number }); });
    if (idx === 0) track("open_preview", { book_id: b.id, chapter_number: ch.chapter_number });

    // Keyboard nav
    document.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      if (e.key === "ArrowRight" && next) { track("next_chapter", { book_id: b.id, chapter_number: next.chapter_number }); location.href = chapterUrl(b, next.chapter_number); }
      if (e.key === "ArrowLeft" && prev) { location.href = chapterUrl(b, prev.chapter_number); }
    });

    // Progress bar
    var bodyEl = $("#chapter-body"), prog = $("#reader-progress span"), progWrap = $("#reader-progress");
    function upd() {
      var r = bodyEl.getBoundingClientRect(), vh = window.innerHeight;
      var total = r.height - vh * 0.6;
      var done = Math.min(1, Math.max(0, (vh * 0.4 - r.top) / Math.max(total, 1)));
      if (r.height < vh * 0.6) done = r.bottom < vh ? 1 : 0;
      prog.style.width = (done * 100).toFixed(1) + "%";
      progWrap.setAttribute("aria-valuenow", String(Math.round(done * 100)));
    }
    window.addEventListener("scroll", upd, { passive: true }); window.addEventListener("resize", upd); upd();

    // Text size (stored on this device only)
    var sizes = [0.875, 1, 1.125, 1.25, 1.4], key = "uwsb-reader-size", si = 1;
    try { var saved = parseInt(localStorage.getItem(key), 10); if (sizes[saved]) si = saved; } catch (e) {}
    var dec = $("#size-dec"), inc = $("#size-inc"), live = $("#size-live");
    function applySize(announce) {
      document.documentElement.style.setProperty("--reader-scale", sizes[si]);
      dec.disabled = si === 0; inc.disabled = si === sizes.length - 1;
      try { localStorage.setItem(key, String(si)); } catch (e) {}
      if (announce) live.textContent = "Text size " + Math.round(sizes[si] * 100) + "%";
      upd();
    }
    dec.addEventListener("click", function () { if (si > 0) { si--; applySize(true); } });
    inc.addEventListener("click", function () { if (si < sizes.length - 1) { si++; applySize(true); } });
    applySize(false);
  }

  /* ---------- home: featured title(s) ---------- */
  function initFeatured() {
    var sec = $("#featured"); if (!sec) return;
    var list = allBooks().filter(function (b) { return b.featured === true; }).slice(0, 3);
    if (!list.length) { sec.remove(); return; }
    function feature(b, i) {
      var pc = previewChapters(b), g = GENRES[b.genre], hid = "featured-h-" + i;
      return '<article class="feature-card" aria-labelledby="' + hid + '">' +
        '<a class="feature-stage" href="' + bookUrl(b) + '" tabindex="-1" aria-hidden="true"' + (b.cover_image ? ' style="--stage-bg:url(\'' + esc((b.cover_srcset ? b.cover_srcset.split(" ")[0] : b.cover_image)) + '\')"' : "") + '>' +
          '<span class="featured-cover">' + coverHTML(b, false, "200px").replace(' alt="' + esc(b.cover_alt) + '"', ' alt=""') + '</span></a>' +
        '<div class="featured-info">' +
          '<div class="badges"><span class="badge">' + esc(g.label) + '</span>' + cleanBadge(b) +
            (pc.length ? '<span class="badge">' + icon("i-eye") + pc.length + ' free chapter' + (pc.length === 1 ? "" : "s") + '</span>' : "") + '</div>' +
          '<h3 id="' + hid + '" class="book-title"><a href="' + bookUrl(b) + '">' + titleHTML(b) + '</a></h3>' +
          (b.tagline ? '<p class="tagline">' + esc(b.tagline) + '</p>' : "") +
          (hasAuthor(b) ? '<p class="byline">by ' + esc(b.author) + '</p>' : "") +
          '<p class="hook">' + esc(b.hook) + draftTag(b) + '</p>' +
          '<div class="btn-row">' +
            (pc.length ? '<a class="btn btn-primary" href="' + chapterUrl(b, pc[0].chapter_number) + '" data-cta="featured-preview">' + icon("i-book") + 'Read ' + readLabel(pc[0]) + ' Free</a>' : "") +
            '<a class="btn btn-ghost" href="' + bookUrl(b) + '" data-cta="featured-book">View Book ' + icon("i-arrow", "i-arrow") + '</a>' +
          '</div>' +
          (validBuyUrl(b) ? "" : '<p class="featured-meta">' + icon("i-check") + 'Free preview, no account needed. Full book coming soon.</p>') +
        '</div></article>';
    }
    $("#featured-list").innerHTML = list.map(feature).join("");
    sec.setAttribute("data-count", String(list.length));
    sec.hidden = false;
  }

  /* ---------- contact form (not connected) ---------- */
  function initContact() {
    var f = $("#contact-form"); if (!f) return;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = $("#form-status");
      s.hidden = false;
      s.textContent = "Thanks for trying the form. It isn\u2019t connected yet, so your message was not sent. Nothing you typed was saved.";
      s.focus();
    });
  }

  /* ---------- home: show "Read Free Chapters" target ---------- */
  function initYear() { $all("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); }); }

  document.addEventListener("DOMContentLoaded", function () {
    initNav(); initFeatured(); initCtaTracking(); initYear();
    initCatalog(); initDetail(); initReader(); initContact();
  });
})();
