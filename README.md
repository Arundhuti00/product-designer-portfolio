# Arundhuti — portfolio

Static site, no build step. The hero is a three.js scene of nine 3D letters you can drag, throw and tap-to-spin.

## Run locally

ES modules and the font file need an HTTP server (opening `index.html` directly won't work):

```bash
npx serve .
```

## Host on GitHub Pages

```bash
git init && git add . && git commit -m "Portfolio hero"
git branch -M main
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

Then repo **Settings → Pages → Deploy from a branch → main / (root)**. All paths are relative, so it works from `<you>.github.io/<repo>/` and from a custom domain.

## Where to tweak

| What | Where |
| --- | --- |
| Name / line breaks | `ROWS` in `js/main.js` (needs one material per letter, 9 are defined) |
| Letter materials (jelly, chrome, fur, sponge, pearl, felt, checker, marble) | `js/materials.js` |
| Throw/bounce feel | `step()` in `js/main.js` (damping, restitution, spring constants) |
| Colours, labels, grid | `css/style.css`, `index.html` |

Fonts: Satoshi (Fontshare, ITF Free Font License) is self-hosted in `assets/fonts/satoshi`; Crimson Text (italic greeting) loads from Google Fonts.

`vendor/three` is a trimmed copy of three.js r186 (MIT); the font is three.js's Helvetiker Bold (see `assets/fonts/LICENSE`).
