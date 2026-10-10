# United We Stand Books — website

Static site hosted on GitHub Pages at https://unitedwestandbooks.com (`CNAME`).
Every page is plain, fully rendered HTML; a small script (`assets/js/app.js`) adds enhancements.

## Structure
```
index.html                              Home
books/index.html                        Catalog (pre-rendered list; search/filter via JS: /books/?genre=…&q=…)
books/<slug>/index.html                 Book page (pre-rendered: cover, byline, badges, description, chapters, details, JSON-LD)
books/<slug>/preview/<n>/index.html     Free preview chapter n (pre-rendered full text; 0 = Prologue)
books/book/, books/preview/             Old query-string URLs; redirect to the pages above (noindex)
about/, why-us/, how-it-works/, clean-book-promise/, contact/, privacy/, terms/
preorder-thanks/                        After-payment page for pre-orders (noindex, not linked)
404.html                                Not-found page
assets/css/styles.css                   Styles (minified)
assets/js/app.js                        Enhancements (minified): nav, catalog search/filter, reader text size,
                                        progress bar and keyboard navigation, contact form
assets/js/catalog.js                    Catalog data for search/filter (generated; no chapter text)
assets/js/books.js                      Book data (generated; source of the pre-rendered pages)
assets/fonts/                           Self-hosted fonts (Inter, Fraunces, Source Serif 4; latin, woff2)
assets/img/                             Brand, cover and social-share images
sitemap.xml, robots.txt                 Generated
```

## Editing
These files are generated. Edit the source and rebuild rather than editing the HTML here:
book data and copy in `gen_books.py`, page templates in `build.py`, script and styles in `src/app.js`
and `src/styles.css`; then run `gen_books.py` and `build.py`. The build pre-renders every page,
minifies CSS/JS (with cache-busting version strings), regenerates `catalog.js`, `sitemap.xml` and
`robots.txt`, and copies `favicon.ico` / `apple-touch-icon.png` to the site root.

## Forms
The contact form and "Notify Me" buttons stay hidden until a form service endpoint is set
(`FORM_ENDPOINT` at the top of `src/app.js`, e.g. a Formspree URL). Until then the contact page says
"Our contact form is coming soon." Pre-Order buttons appear only for books with a `preorder_url`
(a Stripe Payment Link).

## Analytics
None installed. `app.js` records events in `window.dataLayer` only; nothing leaves the browser.
