# IDM CLI — agent/developer guide

Node ≥ 18, ESM, zero build step. The CLI compiles a compact scene JSON into VASCO
(Idomoo's project format), encodes it to a binary `.idm` with the bundled `vasco`
codec, and optionally renders an MP4 via the Idomoo API.

## Layout

- `bin/idm.mjs` — command dispatch, flags, exit codes. Keep agent conventions intact:
  `--json` on stdout, errors on stderr, exit codes 0/1/2/3/4.
- `src/compile.mjs` — scene → VASCO. Sugar is translated; unknown keys pass through
  verbatim so the full VASCO surface stays reachable. Whitelist-style: when adding
  sugar, add the key to the layer's `handled` set.
- `src/tween.mjs`, `src/easing.mjs` — keyframes `{t|f, v, ease}` baked to per-frame
  arrays at comp fps. Ease applies to the segment leaving a keyframe, falling back
  to the next keyframe's ease.
- `src/transform.mjs` — column-major 4×4, translation at [12..14]. The anchor is
  folded into the matrix (`T(position)·R·S·T(−anchor)`); the engine does NOT apply
  `anchor_point` itself. `position` defaults to the anchor.
- `src/render.mjs` — Idomoo API flow: OAuth (Basic account:secret → bearer),
  library get-or-create, scene upload, export poll (wait for `scene_status: "Done"`;
  an empty `errors: []` is NOT an error), then `POST /scenes/generate` with a
  MINIMAL scene object `{scene_id, media, text, audio}` (extra export metadata gets
  rejected, sometimes with a misleading authorization error).
- `src/auth.mjs` — credential resolution: flags > env > `~/.idm/credentials`.
- `vendor/vasco-*.tgz` — the codec, trimmed to its runtime dep (`xxhashjs`). Bundled
  as a file dependency; no registry needed.
- `skills/idm-cli/` — the agent skill (installed by `idm skill install`): CLI usage,
  asset generation, and the scene-authoring guide + `references/`. Update it whenever
  CLI commands or scene-format behavior change.
- `schema/vasco.schema.json` — reference copy of the VASCO schema (the live one is
  imported from the vasco package).

## Engine gotchas (learned by rendering, keep true)

- Sub-compositions must be written BEFORE the comp that references them;
  `entry_point` is the main comp's index (the compiler orders this automatically).
- The encoder reads asset URIs from disk at encode time — the compiler resolves
  them absolute against the scene file's directory.
- VASCO animations are baked per-frame arrays, not keyframes.
- `render` must never silently pick an upload library — interactive runs prompt,
  non-interactive runs fail with the library list.

## Build & distribution

Distribution is **standalone binaries** (Node SEA), built per platform by
`.github/workflows/release.yml` on tag push (`git tag v1.x.y && git push --tags`)
and attached to GitHub releases with a `checksums.txt`. `scripts/install.sh` /
`install.ps1` download + verify + install them; `idm update` self-replaces the
running binary from the latest release.

`scripts/build-sea.mjs` builds locally for the current platform: esbuild bundles
`bin/idm.mjs` into one CJS file, `node --experimental-sea-config` makes the blob,
postject injects it into a copy of the node binary (fuse sentinel
`NODE_SEA_FUSE_<hash>` — note: NOT `NODE_SEA_BLOB_FUSE`). Everything in `bin/`
must stay statically importable: no `import.meta.url` paths, no package.json
reads, no dynamic `import()` with computed paths. Version lives in
`src/version.mjs`.

## Testing

```bash
npm test                    # test/smoke.mjs — compile examples, encode, decode, assert round-trip
node scripts/build-sea.mjs  # then: ./dist/idm_<os>_<arch> compile examples/demo.json
```

No network or credentials needed. CI runs the smoke test on Node 18/20/22,
ubuntu + windows. For a live check: `idm auth status`, then render
`examples/demo.json` into a scratch library.
