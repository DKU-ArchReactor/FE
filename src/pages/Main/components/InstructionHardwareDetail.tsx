import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  displayValue,
  instructionFields,
  numericPc,
  type buildInstructionFlow,
} from "../utils/instructionFlow";
import { adderBits, aluLesson, binaryWord } from "../utils/hardwareLesson";

export default function InstructionHardwareDetail({
  flow,
  unit,
  onClose,
}: {
  flow: ReturnType<typeof buildInstructionFlow>;
  unit: "alu" | "pc-select" | "decoder";
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [byte, setByte] = useState(0);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const lesson = aluLesson(flow),
    bits = adderBits(flow.input1, flow.input2, flow.op === "sub");
  const decoded = instructionFields(flow.raw);
  const specialEncoding =
    decoded && ["1110011", "0001111"].includes(decoded.opcode);
  const card =
    "rounded-xl border border-[var(--ar-border)] bg-[var(--ar-header-bg)] p-4";
  const pc = numericPc(flow.pc),
    sequential = Number.isFinite(pc)
      ? `0x${((pc + 4) >>> 0).toString(16).padStart(8, "0")}`
      : "미제공";
  return createPortal(
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="hardware-detail-title"
      className="fixed inset-0 m-auto max-h-[90vh] w-[min(960px,94vw)] overflow-auto rounded-2xl border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-0 text-[var(--ar-text-primary)] shadow-2xl backdrop:bg-black/45"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--ar-border)] bg-[var(--ar-panel-bg)] px-6 py-4">
        <div>
          <p className="text-sm text-[var(--ar-text-muted)]">
            {flow.op.toUpperCase()} · {flow.pc} ·{" "}
            {flow.actual ? "선택 명령어의 실행 기록" : "실행값 미제공"}
          </p>
          <h2 id="hardware-detail-title" className="mt-1 text-xl font-bold">
            {unit === "alu"
              ? "ALU는 어떻게 계산할까?"
              : unit === "decoder"
                ? "32비트 명령어는 어떻게 해독할까?"
                : "다음 PC를 만드는 구성 요소"}
          </h2>
        </div>
        <button
          autoFocus
          onClick={onClose}
          className="shrink-0 rounded-lg border border-[var(--ar-border)] px-4 py-2 text-base hover:bg-[var(--ar-header-bg)]"
        >
          닫기
        </button>
      </header>
      <div className="space-y-5 p-6 text-base leading-7">
        {unit === "alu" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["입력 A", flow.input1],
                ["입력 B", flow.input2],
                ["CORE 결과", flow.result],
              ].map(([label, value]) => (
                <div key={label} className={card}>
                  <p className="text-sm font-semibold text-[var(--ar-text-muted)]">
                    {label}
                  </p>
                  <p className="mt-2 break-words font-mono text-lg font-bold">
                    {displayValue(value)}
                  </p>
                </div>
              ))}
            </div>
            <div className={card}>
              <p className="font-bold text-[var(--ar-accent)]">
                선택된 연산부 · {lesson.unit}
              </p>
              <p
                data-alu-formula
                className="my-3 break-words font-mono text-2xl font-bold"
              >
                {lesson.formula}
              </p>
              {flow.input1 != null &&
                flow.input2 != null &&
                lesson.category === "adder" && (
                  <p
                    data-numeric-equation
                    className="break-words font-mono text-lg"
                  >
                    {displayValue(flow.input1).split(" · ")[0]}{" "}
                    {lesson.operator}{" "}
                    {displayValue(flow.input2).split(" · ")[0]} →{" "}
                    {displayValue(flow.result)}
                  </p>
                )}
              <ol className="mt-4 list-decimal space-y-2 pl-5">
                {lesson.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              aria-label="ALU의 기능별 회로"
            >
              {[
                ["adder", "가산기"],
                ["logic", "논리 회로"],
                ["shift", "시프터"],
                ["compare", "비교 회로"],
              ].map(([category, title]) => (
                <div
                  key={category}
                  className={`${card} ${lesson.category === category ? "ring-2 ring-[var(--ar-accent)]" : ""}`}
                >
                  <p className="font-bold">{title}</p>
                  <p className="text-sm text-[var(--ar-text-muted)]">
                    {lesson.category === category
                      ? "이 명령어에서 선택"
                      : "다른 연산에서 선택"}
                  </p>
                </div>
              ))}
            </div>
            {lesson.category === "adder" && bits && (
              <section className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">
                    전가산기로 비트 계산 따라가기
                  </h3>
                  <label className="text-sm">
                    볼 비트{" "}
                    <select
                      aria-label="가산기 비트 구간"
                      value={byte}
                      onChange={(event) => setByte(Number(event.target.value))}
                      className="ml-2 rounded border border-[var(--ar-border)] bg-[var(--ar-panel-bg)] p-2"
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <option key={i} value={i}>
                          {i * 8 + 7}~{i * 8}번
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="mt-2 text-sm text-[var(--ar-text-muted)]">
                  실행 입력으로 계산한 학습용 리플 캐리 모델입니다. 오른쪽의
                  낮은 자리에서 왼쪽으로 올림을 전달합니다.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[460px] text-center font-mono">
                    <thead>
                      <tr>
                        <th className="p-2 text-left">비트</th>
                        {bits
                          .slice(byte * 8, byte * 8 + 8)
                          .reverse()
                          .map((bit) => (
                            <th key={bit.index} className="p-2">
                              {bit.index}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["A", "a"],
                        [flow.op === "sub" ? "~B" : "B", "b"],
                        ["올림 입력", "carryIn"],
                        ["합", "sum"],
                        ["올림 출력", "carryOut"],
                      ].map(([label, key]) => (
                        <tr
                          key={key}
                          className="border-t border-[var(--ar-border)]"
                        >
                          <th className="p-2 text-left font-sans text-sm">
                            {label}
                          </th>
                          {bits
                            .slice(byte * 8, byte * 8 + 8)
                            .reverse()
                            .map((bit) => (
                              <td
                                key={bit.index}
                                className={`p-2 font-bold ${key === "sum" ? "text-[var(--ar-accent)]" : ""}`}
                              >
                                {
                                  bit[
                                    key as
                                      | "a"
                                      | "b"
                                      | "carryIn"
                                      | "sum"
                                      | "carryOut"
                                  ]
                                }
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 break-words font-mono text-sm">
                  합 = A XOR B XOR 올림 입력
                  <br />
                  올림 출력 = (A AND B) OR (올림 입력 AND (A XOR B))
                </p>
              </section>
            )}
            {lesson.category === "shift" && flow.amount != null && (
              <div className={card}>
                <h3 className="mb-3 text-lg font-bold">
                  이동량 {flow.amount} = 선택된 이동 단계의 합
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 4, 8, 16].map((distance) => (
                    <div
                      key={distance}
                      className={`rounded-lg border p-2 text-center ${(flow.amount ?? 0) & distance ? "border-[var(--ar-accent)] bg-[var(--ar-panel-bg)]" : "border-[var(--ar-border)]"}`}
                    >
                      <p className="font-bold">{distance}비트</p>
                      <p className="text-sm">
                        {(flow.amount ?? 0) & distance ? "이동 선택" : "통과"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <section className={card}>
              <h3 className="mb-3 text-lg font-bold">32비트 값으로 확인</h3>
              {[
                ["A", flow.input1],
                ["B", flow.input2],
                ["결과", flow.result],
              ].map(([label, value]) => (
                <div key={label} className="mt-2">
                  <span className="mr-3 inline-block w-10 font-bold">
                    {label}
                  </span>
                  <code className="break-all text-sm sm:text-base">
                    {binaryWord(value) ?? "미제공"}
                  </code>
                </div>
              ))}
            </section>
          </>
        ) : unit === "decoder" ? (
          <>
            <div className={card}>
              <p className="text-sm font-semibold">
                명령어 메모리에서 받은 32비트
              </p>
              <p className="mt-2 font-mono text-2xl font-bold">
                {flow.raw ?? "미제공"}
              </p>
              <p className="mt-3 break-all font-mono text-base">
                {binaryWord(flow.raw) ??
                  "기계어가 없어 비트를 추정하지 않습니다."}
              </p>
            </div>
            {decoded && (
              <>
                <p className="text-lg font-bold">
                  {decoded.format}형 · 비트 위치에 따라 필드를 나눕니다.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    [
                      "opcode · 비트 6~0",
                      decoded.opcode,
                      "어떤 종류의 명령어인지 구분합니다.",
                    ],
                    [
                      "rd · 비트 11~7",
                      specialEncoding || decoded.rd == null
                        ? undefined
                        : `x${decoded.rd}`,
                      "결과를 기록할 레지스터 번호입니다.",
                    ],
                    [
                      "rs1 · 비트 19~15",
                      specialEncoding || decoded.rs1 == null
                        ? undefined
                        : `x${decoded.rs1}`,
                      "첫 입력 레지스터 번호입니다. 그 레지스터에 저장된 값 자체와 구분하세요.",
                    ],
                    [
                      "rs2 · 비트 24~20",
                      specialEncoding || decoded.rs2 == null
                        ? undefined
                        : `x${decoded.rs2}`,
                      "두 번째 입력 레지스터 번호입니다.",
                    ],
                    [
                      "funct3 · 비트 14~12",
                      decoded.funct3,
                      "opcode와 함께 세부 연산을 구분합니다.",
                    ],
                    [
                      "funct7 · 비트 31~25",
                      decoded.funct7,
                      "예를 들어 ADD/SUB, SRL/SRA를 구분하는 데 쓰입니다.",
                    ],
                    [
                      decoded.shamt == null
                        ? "즉치값 · 형식에 맞춰 구성"
                        : "shamt · 비트 24~20",
                      specialEncoding
                        ? undefined
                        : decoded.shamt == null
                          ? decoded.immediate == null
                            ? undefined
                            : String(decoded.immediate)
                          : String(decoded.shamt),
                      decoded.shamt == null
                        ? "S/B/J형은 흩어진 비트를 재조합합니다. U형은 하위 12비트를 0으로 구성합니다."
                        : "시프트할 비트 수입니다. 연산 종류를 정하는 funct7과 구분합니다.",
                    ],
                  ]
                    .filter(([, value]) => value != null)
                    .map(([label, value, meaning]) => (
                      <div key={label} className={card}>
                        <h3 className="font-bold">{label}</h3>
                        <p className="mt-2 font-mono text-xl font-bold text-[var(--ar-accent)]">
                          {value}
                        </p>
                        <p className="mt-2">{meaning}</p>
                      </div>
                    ))}
                </div>
                <p>
                  {specialEncoding
                    ? "SYSTEM과 FENCE의 고정 필드는 일반 산술 명령어의 입력 레지스터·즉치값과 다르게 해석합니다. ECALL은 실행 환경에 서비스를 요청합니다."
                    : "레지스터 번호 필드는 레지스터 파일의 읽기·기록 주소로, opcode와 funct 필드는 CU의 연산 선택으로 연결됩니다. 즉치값 생성기는 상수나 주소 오프셋을 구성합니다."}
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-lg">
              ‘다음 주소 회로’는 하나의 부품 이름이 아니라,{" "}
              <strong>가산기와 주소 선택 MUX를 묶어 그린 부분</strong>입니다.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={card}>
                <h3 className="text-lg font-bold">1. 순차 주소 가산기</h3>
                <p>현재 PC에 4를 더합니다. 이 RV32 명령어는 4바이트입니다.</p>
                <p className="mt-3 break-all font-mono text-lg">
                  {flow.pc ?? "미제공"} + 4 = {sequential}
                </p>
                <p className="mt-2 text-sm text-[var(--ar-text-muted)]">
                  JAL/JALR가 레지스터에 기록하는 복귀 주소도 PC+4입니다.
                </p>
              </div>
              <div className={card}>
                <h3 className="text-lg font-bold">2. 목적지 주소 계산</h3>
                <p>분기·JAL: 현재 PC + 즉치값</p>
                <p>JALR: (rs1 값 + 즉치값)의 맨 아래 비트를 0으로 만듭니다.</p>
                <p className="mt-3 font-mono">
                  즉치값 {flow.immediate ?? "미제공"}
                </p>
              </div>
              <div className={card}>
                <h3 className="text-lg font-bold">3. PC 선택 MUX</h3>
                <p>
                  계산된 주소들 중 하나를 고릅니다. CU의 선택 신호와 분기 비교
                  결과를 사용합니다.
                </p>
                <p className="mt-3 font-bold text-[var(--ar-accent)]">
                  {flow.branch
                    ? flow.taken == null
                      ? "분기 판정 미제공"
                      : flow.taken
                        ? "분기 성립 → 목적지"
                        : "분기 불성립 → PC+4"
                    : flow.jump
                      ? "점프 → 목적지"
                      : "순차 실행 → PC+4"}
                </p>
              </div>
              <div className={card}>
                <h3 className="text-lg font-bold">4. PC 레지스터</h3>
                <p>선택한 주소를 저장해 다음 명령어 읽기에 사용합니다.</p>
                <p className="mt-3 break-all font-mono text-xl font-bold">
                  관찰된 다음 PC
                  <br />
                  {flow.nextPc ?? "미제공"}
                </p>
              </div>
            </div>
          </>
        )}
        <p className="border-t border-[var(--ar-border)] pt-4 text-sm text-[var(--ar-text-muted)]">
          입력과 CORE 결과는 선택한 실행 기록입니다. 내부 회로는 동작 원리를
          설명하는 교육 모델이며, CORE의 물리 회로나 게이트 전파 기록을 뜻하지
          않습니다.
        </p>
      </div>
    </dialog>,
    document.body,
  );
}
