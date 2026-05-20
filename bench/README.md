# tscodegen perf benchmarks

Run `node bench/bench.mjs` after `yarn build` to reproduce.

## What dominates runtime

In a typical end-to-end task (build a file, format with Prettier, lock,
save), **Prettier accounts for ~85–95% of wall time.** The codegen layer
itself (`CodeBuilder`, manual-section extraction, codelock hash) handles
even a 1000-line file in ~0.25 ms — there is essentially no headroom for
a Rust/WASM rewrite of that layer to claw back.

The remaining cost lives in two places inside `format()`:

1. **Prettier config resolution.** `resolveConfigFile()` + `resolveConfig()`
   walk the filesystem from cwd looking for `.prettierrc`. Measured at
   ~6.6 ms per call. Before the cache fix, this ran on every single
   `.format()` invocation.
2. **Prettier formatting itself.** Parsing TypeScript and re-emitting it
   is the actual heavy work: ~1.4 ms for a tiny file, ~48 ms for 1000
   lines. There is no way to speed Prettier itself up from inside this
   library.

## Current results (after the cwd-keyed config cache)

| operation                                  | before  | after   | speedup |
| ------------------------------------------ | ------- | ------- | ------- |
| tiny (5 lines), format, lock               | 8.47 ms | 1.49 ms | 5.7x    |
| medium (100 lines), format, lock           | 11.28 ms| 4.31 ms | 2.6x    |
| large (1000 lines), format, lock           | 55.66 ms| 48.03 ms| 1.16x   |
| tiny, no format, lock                      | 52 µs   | 47 µs   | —       |
| medium (100 lines), no format, lock        | 68 µs   | 64 µs   | —       |
| large (1000 lines), no format, lock        | 261 µs  | 232 µs  | —       |
| regen w/ 50 manual sections, lock          | 184 µs  | 143 µs  | —       |

The `no format` rows are unchanged; the codegen layer was already fast.
The diminishing speedup as files grow is expected: Prettier itself
dominates large-file runtime, and the cache fix only removes the
constant per-call overhead.

## What about a Rust/WASM port?

Profiled separately. The non-format pipeline emits a 1000-line file in
~232 µs. Even an idealised 100x port of that layer would shave ~230 µs
off a 48 ms end-to-end large-file operation — under 0.5%. Not worth the
distribution cost (per-platform prebuilt binaries or a 1–5 MB WASM
bundle) and the loss of native-JS ergonomics.

The only meaningful Rust angle is **swapping Prettier for a Rust-based
formatter.** A throwaway prototype using Biome (Rust, distributed as a
WASM module via npm) measured:

| operation                       | Prettier (cached) | Biome WASM | factor |
| ------------------------------- | ----------------- | ---------- | ------ |
| tiny, format, lock              | 1.49 ms           | 0.34 ms    | 4.4x   |
| medium (100 lines), format, lock| 4.31 ms           | 1.78 ms    | 2.4x   |
| large (1000 lines), format, lock| 48.03 ms          | 10.31 ms   | 4.7x   |
| pure format(1000 lines)         | 49.30 ms          | 9.57 ms    | 5.1x   |

Caveats: Biome's output is not byte-identical to Prettier's (different
defaults: tabs vs spaces, different wrapping heuristics), so it cannot
be a transparent drop-in. The right shape would be an optional formatter
hook (`format({ engine: "biome" })` or a pluggable formatter argument),
not a wholesale swap.

## Stacking the wins

| layer                                          | tiny     | large     |
| ---------------------------------------------- | -------- | --------- |
| baseline                                       | 8.47 ms  | 55.66 ms  |
| + cached prettier config (shipped)             | 1.49 ms  | 48.03 ms  |
| + biome instead of prettier (opt-in, hypothetical) | 0.34 ms | 10.31 ms |
| + no formatter at all (already possible)       | 0.05 ms  | 0.23 ms   |

100x is only achievable by not formatting (which already works — just
don't call `.format()`). Realistic optimised path: ~5–25x via the config
cache + an opt-in Biome formatter.

## Reproducing the Biome numbers

```sh
yarn add -D @biomejs/js-api @biomejs/wasm-nodejs
node bench/bench-biome.mjs
```

`bench-biome.mjs` runs the same end-to-end pipeline but pipes the
generated code through Biome's WASM `formatContent` instead of calling
`.format()`. It's kept around as a documented experiment; Biome is not a
runtime dependency.
