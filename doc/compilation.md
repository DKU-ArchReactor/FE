# Compilation page

Open `/c-to-asm`. The datapath stays at `/`; `/total` is a placeholder for the separate summary feature. `/coming-soon` remains compatible.

## Run and verify

1. Copy `.env.example` to `.env.local` and set `VITE_API_URL` to the intended BE. The example uses the demo endpoint documented in BE's `core` branch. It must allow the local frontend origin.
2. Run `npm ci`, then `npm run dev`.
3. Edit the starter source in Monaco or open a UTF-8 `.c` file (up to 64 KiB), then compile. The exact current editor contents are sent to the compiler.
4. Select a C line: its mapped instruction rows highlight. Select an assembly instruction to return to its C line. Shift-click a second C line to select a range.
5. Run `npm test` and `npm run build` before pushing changes.

The page calls `/api/v1/build/compile` with `content`, `lang: c`, `compile_profile: rv32im`, and `compiler_opt: -O0 -g`. It reads the returned `assembly_url` without an Authorization header. It does not invoke simulation or retain execution tokens. Compiling creates anonymous artifacts on the configured backend.

## Mapping boundary

The BE writes input to `source.c`. `mapping.ts` reads GNU `.file` / `.loc` directives in the generated assembly and associates executable instruction rows with that file's source lines. Foreign files, line zero, out-of-range locations and unannotated instructions are not mapped. Data/debug sections are excluded from the comparison view but remain in the raw output.

This is compiler-authored **source-line attribution**, not an AST-to-instruction proof or a linked ELF address map. Prologues/epilogues can belong to braces; one C line can map to multiple noncontiguous instruction groups; pseudo-instructions may expand later. The assembly gutter shows original file line numbers, never invented PC addresses. Do not reuse the datapath's hardcoded `PC_TO_C_LINE_MAP` here.

References: [GNU as .loc](https://sourceware.org/binutils/docs/as/Loc.html), [GCC debugging options](https://gcc.gnu.org/onlinedocs/gcc/Debugging-Options.html).

`tests/fixtures/arithmetic.s` was compiled by the demo BE on 2026-10-31 with the options above from `examples.ts`'s arithmetic source. Temporary build paths are normalized. It contains no URLs, credentials, or execution tokens. Tests independently assert that source line 4 maps to two loads, one add and one store.

## Source-derived structure inspection

The Monaco editor is the source of truth for both compilation and the side panel. The inspector reparses the current text as it changes and shows only declarations it recognizes: `struct` fields and instances, array names and declared dimensions, plus pointer targets explicitly written in aggregate initializers. It never fabricates array, list, or tree examples. A self-referential pointer field alone does not establish a linked list; assignments, loops, heap allocation and runtime pointer values are not inferred. This is a lightweight declaration inspector, not a full C parser or runtime memory view.

## Feature branches

- `feat/compile-page`: standalone page, navigation and compile transport.
- `feat/source-mapping`: builds on compile-page; compiler line mapping and regression tests.
- `feat/structure-visualization`: builds on source-mapping; bounded educational structure diagrams.

Branches are stacked in that order. Merge prerequisites first, or review each branch against its predecessor. No feature branch has been merged into main automatically.
