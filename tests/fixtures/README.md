# Real compiler/runtime fixtures

`structures.elf` is compiled from `samples/compile-structures.c`; `long.elf` and `long.s` are compiled from `samples/compile-long.c`. All use the demo BE RV32IM profile, `-O0 -g`, on 2026-11-01.

`structures-trace.json` and `long-trace.json` contain selected actual single-mode CORE snapshots (every 40th record plus the final record), preserving original clocks. They are test evidence, not simulated frontend data. No signed artifact URL, auth credential, or simulation token is saved. ELF debug sections retain temporary build paths.

Independent DWARF expectations were checked with pyelftools: structures.values uses DW_OP_fbreg -48 and CFI establishes CFA from x8 after the prologue; its initialized values are 3,5,7,9 at address 0x7fffefcc. The long program terminates with a0=65, and actual pointer snapshots show list[0].next changing from list[1] to list[2].
