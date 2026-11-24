import { type TransferUnit } from "./instructionFlow";

export type Box = { x: number; y: number; w: number; h: number };

export const COLORS = {
  address: "var(--ar-flow-address)",
  data: "var(--ar-flow-data)",
  control: "var(--ar-flow-control)",
};

export const BOXES: Record<TransferUnit, Box> = {
  pc: { x: 55, y: 175, w: 190, h: 120 },
  decoder: { x: 335, y: 175, w: 490, h: 180 },
  registers: { x: 35, y: 390, w: 280, h: 210 },
  immediate: { x: 415, y: 390, w: 190, h: 125 },
  cu: { x: 690, y: 390, w: 270, h: 180 },
  "operand-mux": { x: 375, y: 625, w: 300, h: 100 },
  alu: { x: 710, y: 625, w: 300, h: 205 },
  mux: { x: 375, y: 865, w: 300, h: 100 },
  "pc-select": { x: 55, y: 865, w: 240, h: 180 },
  "instruction-memory": { x: 1200, y: 230, w: 320, h: 210 },
  memory: { x: 1200, y: 705, w: 320, h: 210 },
};

export const TITLES: Record<TransferUnit, string> = {
  pc: "PC",
  decoder: "Instruction Decoder",
  cu: "Control Unit",
  registers: "Registers",
  immediate: "Imm Gen",
  "operand-mux": "MUX",
  alu: "ALU",
  mux: "MUX",
  "pc-select": "PC Select",
  "instruction-memory": "Instruction Memory",
  memory: "Data Memory",
};

export const ROLES: Record<TransferUnit, string> = {
  pc: "명령어 주소",
  decoder: "CU의 해독 회로 · 명령어 필드 분리",
  cu: "계산·읽기·쓰기를 제어",
  registers: "입력·계산 결과 보관",
  immediate: "상수 생성",
  "operand-mux": "ALU의 두 번째 입력 선택",
  alu: "연산 회로 선택",
  mux: "레지스터에 쓸 결과 선택",
  "pc-select": "가산기 + PC MUX",
  "instruction-memory": "주소 → 명령어 읽기",
  memory: "주소 → 읽기·쓰기",
};

export const AUXILIARY_CONNECTIONS = new Set([
  "pc-input",
  "pc-control",
  "next-pc",
  "result-link",
  "pc-immediate",
  "pc-base",
  "branch-decision",
]);

// Fixed physical-model connections: instructions select paths, never change the topology.
export const WIRES: { key: string; kind: keyof typeof COLORS; system?: boolean }[] = [
  { key: "fetch-address", kind: "address", system: true },
  { key: "fetch-instruction", kind: "data", system: true },
  { key: "decode-control", kind: "control" },
  { key: "decode-immediate", kind: "data" },
  { key: "read-control", kind: "control" },
  { key: "input-a-register", kind: "data" },
  { key: "input-a-pc", kind: "data" },
  { key: "input-b-register", kind: "data" },
  { key: "input-b-immediate", kind: "data" },
  { key: "mux-to-alu", kind: "data" },
  { key: "memory-address", kind: "address", system: true },
  { key: "memory-control", kind: "control", system: true },
  { key: "store-data", kind: "data", system: true },
  { key: "load-data", kind: "data", system: true },
  { key: "result-alu", kind: "data" },
  { key: "result-link", kind: "data" },
  { key: "writeback", kind: "data" },
  { key: "pc-input", kind: "address" },
  { key: "pc-immediate", kind: "data" },
  { key: "pc-base", kind: "address" },
  { key: "pc-control", kind: "control" },
  { key: "next-pc", kind: "address" },
  { key: "branch-decision", kind: "control" },
  { key: "alu-select-control", kind: "control" },
  { key: "operand-select-control", kind: "control" },
  { key: "register-write-control", kind: "control" },
  { key: "write-select-control", kind: "control" },
];
