import type { languages } from "monaco-editor";

export const RISCV_LANGUAGE_ID = "riscv";

export const riscvLanguageDef: languages.IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".riscv",
  ignoreCase: false,

  keywords: [
    // ALU instructions
    "add", "addi", "sub", "lui", "auipc",
    "and", "andi", "or", "ori", "xor", "xori",
    "sll", "slli", "srl", "srli", "sra", "srai",
    "slt", "slti", "sltu", "sltiu",
    // Branch / Jump
    "beq", "bne", "blt", "bge", "bltu", "bgeu",
    "jal", "jalr",
    // Memory Load / Store
    "lb", "lh", "lw", "lbu", "lhu",
    "sb", "sh", "sw",
    // System / Pseudo
    "ecall", "ebreak", "fence",
    "nop", "li", "la", "mv", "not", "neg", "negw",
    "sext.w", "seqz", "snez", "sltz", "sgtz",
    "beqz", "bnez", "blez", "bgez", "bltz", "bgtz",
    "bgt", "ble", "bgtu", "bleu",
    "j", "jr", "ret", "call", "tail",
    // M extension
    "mul", "mulh", "mulhsu", "mulhu", "div", "divu", "rem", "remu",
  ],

  registers: [
    "zero", "ra", "sp", "gp", "tp", "fp",
    "t0", "t1", "t2", "t3", "t4", "t5", "t6",
    "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11",
    "a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7",
    "x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7",
    "x8", "x9", "x10", "x11", "x12", "x13", "x14", "x15",
    "x16", "x17", "x18", "x19", "x20", "x21", "x22", "x23",
    "x24", "x25", "x26", "x27", "x28", "x29", "x30", "x31",
  ],

  tokenizer: {
    root: [
      // Directives
      [/\.[a-zA-Z_]\w*/, "keyword.directive"],

      // Labels
      [/^[a-zA-Z_]\w*:/, "type.identifier"],
      [/\b[a-zA-Z_]\w*:/, "type.identifier"],

      // Registers
      [/\b([a-z][0-9]{1,2}|zero|ra|sp|gp|tp|fp|s[0-9]{1,2}|t[0-6]|a[0-7]|x[0-9]{1,2})\b/, {
        cases: {
          "@registers": "variable.predefined",
          "@default": "identifier",
        },
      }],

      // Instructions
      [/\b[a-z][a-z0-9_.]*\b/, {
        cases: {
          "@keywords": "keyword",
          "@default": "identifier",
        },
      }],

      // Numbers
      [/0[xX][0-9a-fA-F]+/, "number.hex"],
      [/-?\d+/, "number"],

      // Comments
      [/#.*$/, "comment"],
      [/\/\/.*$/, "comment"],

      // Strings
      [/"([^"\\]|\\.)*"/, "string"],
    ],
  },
};
