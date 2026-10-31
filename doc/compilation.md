# Compilation page

Open `/c-to-asm`. The datapath stays at `/`; `/total` is a placeholder for the separate summary feature. `/coming-soon` remains compatible.

## Run and verify

1. Copy `.env.example` to `.env.local` and set `VITE_API_URL` to the intended BE. The example uses the demo endpoint documented in BE's `core` branch. It must allow the local frontend origin.
2. Run `npm ci`, then `npm run dev`.
3. Edit the starter source in Monaco or open a UTF-8 `.c` file (up to 64 KiB), then compile. The exact current editor contents are sent to the compiler.
4. Select a C line: its mapped instruction rows highlight. Select an assembly instruction to return to its C line. Shift-click a second C line to select a range.
5. Run `npm test` and `npm run build` before pushing changes.

The page calls `/api/v1/build/compile` with `content`, `lang: c`, `compile_profile: rv32im`, and `compiler_opt: -O0 -g`. It reads signed assembly/ELF URLs without an Authorization header. Compilation alone does not run the program. The optional runtime inspector retains the returned execution token in page memory and invokes the existing simulation API only when the user requests execution. Source changes discard the result and cancel pending runtime work. Compiling creates anonymous artifacts on the configured backend.

## Mapping boundary

The BE writes input to `source.c`. `mapping.ts` reads GNU `.file` / `.loc` directives in the generated assembly and associates executable instruction rows with that file's source lines. Foreign files, line zero, out-of-range locations and unannotated instructions are not mapped. Data/debug sections are excluded from the comparison view but remain in the raw output.

This is compiler-authored **source-line attribution**, not an AST-to-instruction proof or a linked ELF address map. Prologues/epilogues can belong to braces; one C line can map to multiple noncontiguous instruction groups; pseudo-instructions may expand later. The assembly gutter shows original file line numbers, never invented PC addresses. Do not reuse the datapath's hardcoded `PC_TO_C_LINE_MAP` here.

References: [GNU as .loc](https://sourceware.org/binutils/docs/as/Loc.html), [GCC debugging options](https://gcc.gnu.org/onlinedocs/gcc/Debugging-Options.html).

`tests/fixtures/arithmetic.s` was compiled by the demo BE on 2026-10-31 with the options above from `examples.ts`'s arithmetic source. Temporary build paths are normalized. It contains no URLs, credentials, or execution tokens. Tests independently assert that source line 4 maps to two loads, one add and one store.

## Source-derived structure inspection

The Monaco editor is the source of truth for compilation and source inspection. Lezer's C/C++ syntax tree supplies declarations, typedef aliases, field declarators, multidimensional arrays, designated initializers and function ranges. The source inspector shows syntax diagnostics and warns when preprocessing can change declarations. It is not a semantic C compiler; macro expansion, ambiguous typedefs, extensions and complex declarations may be unavailable. Explicit initializer links are shown as declaration information, never as runtime snapshots.

After compilation, the runtime inspector downloads the actual ELF, decodes supported DWARF 4/5 locations, frame rules and line tables, then requests a single-mode CORE trace (up to 2000 cycles). A cycle slider/replay shows actual local/global values, array elements and typed pointer connections. Unsupported metadata or absent memory is displayed as unavailable. Type/element/node limits are shown in the UI. Allocation lifetime, arbitrary optimized location expressions, range lists, bitfields and multidimensional runtime arrays are not interpreted. Details of the read-only backend audit and live validation are in `compile-environment-audit.md`.

`samples/compile-long.c` is a 144-line example with array traversal, function calls, list rewiring and tree lookup. Load it through the file button, compile, select a function or source line, and use **실행·메모리 보기** to request execution. It completed in the live CORE at 1688 cycles with final a0=65. Move the slider to a main-function cycle to see the local list/tree arrays, or into `sum_list` to see typed parameter pointers. The code also includes uncalled helper functions for long-source navigation testing.

## Feature branches

- `feat/compile-page`: standalone page, navigation and compile transport.
- `feat/source-mapping`: builds on compile-page; compiler line mapping and regression tests.
- `feat/structure-visualization`: builds on source-mapping; bounded educational structure diagrams.
- `feat/compile-blocks`: builds on structure-visualization; Monaco and paired source/instruction layout.
- `feat/compile-analysis`: builds on compile-blocks; syntax analysis, real DWARF/CORE memory replay, long-source navigation and fixtures.

Branches are stacked in that order. Merge prerequisites first, or review each branch against its predecessor. No feature branch has been merged into main automatically.
