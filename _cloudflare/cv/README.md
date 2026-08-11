# cv.vieux.fr

This Cloudflare Worker bundles the two static resume files in this directory and
serves the format suited to the client:

- Browsers receive `resume.pdf` inline.
- `curl` receives `resume.txt` as plain text.
- `/resume.pdf` and `/resume.txt` select a format explicitly.

The Worker returns the files rather than redirecting so a plain
`curl https://cv.vieux.fr` prints the resume without requiring `-L`.

## Test

```sh
node --test worker.test.mjs
```

## Deploy

```sh
npx wrangler deploy
```

The Worker route attaches to the existing proxied `cv.vieux.fr` DNS record. The
rest of `vieux.fr` continues to be served by GitHub Pages. GitHub Pages excludes
this underscore-prefixed directory, including the resume source files.
