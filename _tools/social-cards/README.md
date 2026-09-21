# Social card generator

The generator creates the 1200×627 preview images referenced by the blog posts' Open Graph metadata. Its source lives under `_tools`, which is explicitly excluded from the GitHub Pages build in `_config.yml`.

Install the local dependency once:

```sh
pnpm --dir _tools/social-cards install
```

Generate every configured card from the repository root:

```sh
pnpm --dir _tools/social-cards generate
```

Generate one card:

```sh
pnpm --dir _tools/social-cards generate --card cocktailsnap-native
```

For a new post, add an entry to `cards.json`. `slug` is the post directory and output directory, while `images` contains paths relative to the repository root. The generic `single` layout accepts one image; the existing `phone`, `windows`, and `game` layouts preserve the current cards.

To review output without replacing the published card files, pass a temporary output directory:

```sh
pnpm --dir _tools/social-cards generate --output-dir /tmp/social-cards
```

Set `CHROME_PATH` if Playwright cannot find its downloaded browser and Chrome is installed in a nonstandard location. If ImageMagick is available, the generator also strips metadata and compresses each PNG.
