# Repository guide

This repository is the source for `https://vieux.fr`. It is a small static site deployed from `master` by GitHub Pages. Keep changes simple: use plain HTML, the shared CSS and JavaScript in `assets/`, and local images when practical.

## Create a blog post

1. Choose a short lowercase URL slug and create `<slug>/index.html`.
2. Copy the most recent blog post as the structural starting point. Preserve the home link, theme toggle, byline, read-aloud controls, shared stylesheets, shared read-aloud script, and footer.
3. Replace all post-specific content and metadata. The visible `<h1>`, `<title>`, `og:title`, and `twitter:title` must agree. The visible date and `article:published_time` must represent the same day.
4. Add the post near the top of the `Posts` list in the root `index.html`.
5. Store post-specific images in the post directory. Give every meaningful image useful `alt` text and use a `<figcaption>` when context or attribution helps.
6. Add the canonical post URL to `sitemap.xml`. Keep the `BlogPosting` JSON-LD in the post head synchronized with its title, description, canonical URL, image, author, and publication date. Use the homepage as the author URL. Only add `dateModified` or sitemap `lastmod` when an accurate date is available; do not invent dates or refresh them for every deployment.
7. Add the post to `feed.xml`, newest first. Use its exact title, search description, canonical HTTPS URL (with trailing slash) for both `link` and permalink `guid`, and its publication date in RFC 2822 format with timezone for `pubDate`. Keep feed titles and descriptions synchronized when editing posts; preserve publication dates and GUIDs.

Every post head must include:

- A useful search description, author, and viewport.
- A canonical URL in the form `https://vieux.fr/<slug>/`.
- RSS discovery: `<link rel="alternate" type="application/rss+xml" title="Victor Vieux — RSS" href="https://vieux.fr/feed.xml">`.
- Open Graph type, site name, URL, title, description, image, image dimensions, image alt text, and publication time.
- Twitter large-image card, title, description, image, and image alt text.
- An absolute social image URL in the form `https://vieux.fr/<slug>/social-card.png`.
- `../assets/site.css`, `../assets/blog.css`, `../assets/read-aloud.css`, and `../assets/read-aloud.js`.

Use `assets/blog.css` for rules shared by posts. Keep inline CSS limited to layout that is genuinely specific to one article. When two posts need the same rule, move it into the shared stylesheet.

Keep the recorded read-aloud control markup directly below the byline. Generate narration
with Pocket TTS in Docker using `_tools/pocket-tts/generate.py`; see
`_tools/pocket-tts/README.md` for setup and the full workflow. From the repository root:

```sh
docker compose -f _tools/pocket-tts/compose.yaml up -d --build
# Wait for http://127.0.0.1:8765/health to report healthy.
python3 _tools/pocket-tts/generate.py <slug>
```

The generator reads headings, paragraphs, list items, and preformatted text from
`<main>`, skipping figures, dates, bylines, controls, hidden content, and elements
marked with `data-read-aloud-ignore`. It writes `<slug>/narration.m4a` and updates
the player duration. Regenerate after changing spoken article text, preview the
audio, and commit the HTML and audio together. Keep intermediate WAV/text files
in the ignored `_tools/pocket-tts/output/` directory. Playback must work without
JavaScript; the shared script adds playback speed controls.

For external links that open a new tab, use `target="_blank" rel="noopener"`. Check the article at desktop and mobile widths, in both light and dark themes.

## Generate social images

The reusable generator is in `_tools/social-cards`. Its source and dependencies are excluded from GitHub Pages; generated `<slug>/social-card.png` files are public site assets.

Install dependencies from the repository root:

```sh
pnpm --dir _tools/social-cards install
```

For a new post, add an entry to `_tools/social-cards/cards.json` with:

- `slug`: the post directory and output directory.
- `title`: normally the exact article title.
- `subtitle`: one short sentence that remains legible in a link preview.
- `layout`: use `single` for a general image, or an existing specialized layout when appropriate.
- `images`: source paths relative to the repository root.

Review a new card without replacing the checked-in image:

```sh
pnpm --dir _tools/social-cards generate --card <slug> --output-dir /tmp/social-cards
```

Open `/tmp/social-cards/<slug>/social-card.png` and check that no text is clipped, the title is readable at thumbnail size, and the source image supports the story. Then generate the committed asset:

```sh
pnpm --dir _tools/social-cards generate --card <slug>
```

The output must remain 1200×627. The generator uses ImageMagick for metadata stripping and compression when `magick` is available. Set `CHROME_PATH` if Playwright cannot find Chromium or a system Chrome installation. Do not edit generated PNGs by hand; update `cards.json` or `generate.cjs` and regenerate them.

Whenever a title, description, slug, or card changes, keep the HTML metadata, visible article content, homepage link, card configuration, and generated PNG in sync.

## Validate and deploy

Before committing:

```sh
git diff --check
magick identify <slug>/social-card.png
python3 -m http.server 8000
```

Confirm that the card is 1200×627, all local images load, the canonical and social URLs are absolute, and the page remains usable without JavaScript. Do not commit `_tools/social-cards/node_modules/`.

Pushes to `master` trigger the GitHub Pages workflow. After a requested deployment, wait for `pages-build-deployment` to succeed and verify the live page and social image return HTTP 200. Repository-only material must stay in `_tools`, `_cloudflare`, or be explicitly listed in `_config.yml` under `exclude`. Verify excluded files return HTTP 404 on `vieux.fr` after deployment.

LinkedIn may cache an older preview. Once the live metadata and image are correct, use LinkedIn Post Inspector to refresh its cache when needed.
