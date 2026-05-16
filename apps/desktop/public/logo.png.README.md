# public/logo.png

The Desktop app references `/logo.png` at runtime. Copy or symlink
`../../img/logo.png` to `public/logo.png` before running `npm run build`
so the bundle ships the brand asset.

A `scripts/sync-logo.mjs` step will automate this in a later phase.
