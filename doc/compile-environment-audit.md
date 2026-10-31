# Compilation environment audit (2026-11-01)

Inspection only: BE and CORE files were not edited or deployed.

## Backend

The local BE `main` branch is a scaffold. The implemented service was inspected at `origin/core`, commit `1382032e18c302ab89ba5e6ca0578ae85fabf37d`.

- `Dockerfile.prod` installs `gcc-riscv64-unknown-elf` and `binutils-riscv64-unknown-elf`. It does not install a C library/header package such as newlib/picolibc. This agrees with the observed missing `stdio.h` compilation error; installed packages on the running host were not independently enumerated.
- `app/services/build_service.py` accepts `native` and `rv32im` profiles. The request schema defaults to `rv32im`; the compile page explicitly requests it.
- RV32IM flags: `-march=rv32im -mabi=ilp32 -O0 -ffreestanding -nostdlib -nostartfiles -fno-pic -fno-pie -fno-builtin -fno-inline -msmall-data-limit=0`.
- Each compile process has a 10-second timeout. Allowed extra flags are optimization levels, warnings, `-g`, and selected C standard flags.
- C compilation first generates assembly with `-S`, then links an ELF using `rv32im/start.S`, `link.ld`, and `--no-relax`. An ELF link failure makes the entire build fail even if assembly generation succeeded. Artifact upload is success-only.
- `-nostdlib` disables automatic standard library linking; it does not itself remove header files. Supporting ordinary `printf` requires both headers and a compatible implementation/output environment. Floating-point expressions may also require compiler helper libraries when using RV32IM.
- `binary/postprocess.py` currently passes through the ELF unchanged, preserving DWARF debug metadata when `-g` is requested.
- Successful anonymous builds return a short-lived `simulation_token` and presigned assembly/ELF URLs. Tokens are retained in page memory only, never written to example files or logs.
- `/api/v1/simulation/run` accepts exactly one of `simulation_token`/`build_id`, mode `single`/`pipeline`, and `max_cycles` 1–2000. It forwards the ELF to CORE over gRPC. ELF is capped at 256 KiB; the gRPC result is capped at 8 MiB.

## CORE and runtime visualization

CORE source inspected at commit `1bf2957eb2d647a6b8c3983c3fa945a5580dbb83`.

- `app/simulator.py` includes actual register values and memory snapshots in every history item. Results distinguish COMPLETED, CYCLE_LIMIT, and SIMULATION_ERROR.
- The FE can therefore run existing builds and replay memory without changing BE/CORE. Source variable addresses are recovered from the existing ELF's DWARF information, not from register-name guesses.
- The new FE reader supports ELF32 little endian RISC-V, DWARF 4/5 basic forms, direct locations, CFA-relative locals with `.debug_frame`, and source address ranges from `.debug_line`. Unsupported forms, location/range lists, complex expressions, bitfields, and unknown memory are explicitly unavailable.
- Variable graphs reflect actual captured pointers. They do not establish whether an allocation has been freed or a local has completed C initialization. Typed pointer traversal is bounded and only follows memory actually present in the trace.

## Evidence

`samples/compile-long.c` was compiled through the configured service and simulated in single mode. It completed at 1688 cycles with final a0 = 65. It exercises array traversal, calls, list traversal/rewiring, and tree lookup. The fixture trace stores selected snapshots only, with original clock numbers preserved; the UI uses full live traces.

PC alignment was checked against a real function boundary at cycle 1320. The global fetch PC is 0x00010168 while the sole in-flight instruction is at 0x00010164. Runtime scope/CFI interpretation uses the single in-flight buffer PC; after the pipeline drains it uses the next fetch PC with the updated registers. Multiple simultaneous instruction PCs are treated as ambiguous instead of guessing a frame. Memory/register snapshots may reflect different machine stages, and are not presented as atomic C statement snapshots.
