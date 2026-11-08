import React, { useState, useEffect } from 'react';

interface RegisterVisualizerProps {
  registers: Record<string, string>;
  prevRegisters?: Record<string, string>;
  playSpeed?: number;
  cycle?: number;
}

// 16진수 문자열을 사람이 읽기 편한 부호 있는 10진수로 변환 (32비트 2의 보수)
const formatSignedDec = (hexStr: string): string => {
  const num = parseInt(hexStr, 16);
  if (isNaN(num)) return '0';
  const signed = num | 0;
  return signed.toLocaleString();
};

type RegisterGroup = 'zero' | 'special' | 'args' | 'saved' | 'temp';

// 레지스터 메타데이터: ABI 이름, 그룹, 역할 설명
interface RegisterMeta {
  abi: string;
  group: RegisterGroup;
  role: string;
  desc?: string;
}

const REGISTER_METAS: Record<string, RegisterMeta> = {
  x0: { abi: 'zero', group: 'zero', role: '항상 0 고정', desc: 'Hardwired 0 (항상 0 고정)' },
  x1: { abi: 'ra', group: 'special', role: '함수 반환 주소', desc: 'Return Address (함수 반환 주소)' },
  x2: { abi: 'sp', group: 'special', role: '스택 포인터', desc: 'Stack Pointer (스택 포인터: 0x7FFFEFFC)' },
  x3: { abi: 'gp', group: 'special', role: '전역 포인터', desc: 'Global Pointer (전역 포인터)' },
  x4: { abi: 'tp', group: 'special', role: '스레드 포인터', desc: 'Thread Pointer (스레드 포인터)' },
  x5: { abi: 't0', group: 'temp', role: '임시 레지스터', desc: 'Temporary 0 (임시 저장)' },
  x6: { abi: 't1', group: 'temp', role: '임시 레지스터', desc: 'Temporary 1 (임시 저장)' },
  x7: { abi: 't2', group: 'temp', role: '임시 레지스터', desc: 'Temporary 2 (임시 저장)' },
  x8: { abi: 's0', group: 'saved', role: '저장 / 프레임 포인터', desc: 'Saved register 0 / Frame Pointer' },
  x9: { abi: 's1', group: 'saved', role: '저장 레지스터', desc: 'Saved register 1' },
  x10: { abi: 'a0', group: 'args', role: '함수 인자 / 반환값', desc: 'Function argument 0 / Return value 0' },
  x11: { abi: 'a1', group: 'args', role: '함수 인자 / 반환값', desc: 'Function argument 1 / Return value 1' },
  x12: { abi: 'a2', group: 'args', role: '함수 인자', desc: 'Function argument 2' },
  x13: { abi: 'a3', group: 'args', role: '함수 인자', desc: 'Function argument 3' },
  x14: { abi: 'a4', group: 'args', role: '함수 인자', desc: 'Function argument 4' },
  x15: { abi: 'a5', group: 'args', role: '함수 인자', desc: 'Function argument 5' },
  x16: { abi: 'a6', group: 'args', role: '함수 인자', desc: 'Function argument 6' },
  x17: { abi: 'a7', group: 'args', role: '함수 인자', desc: 'Function argument 7' },
  x18: { abi: 's2', group: 'saved', role: '저장 레지스터', desc: 'Saved register 2' },
  x19: { abi: 's3', group: 'saved', role: '저장 레지스터', desc: 'Saved register 3' },
  x20: { abi: 's4', group: 'saved', role: '저장 레지스터', desc: 'Saved register 4' },
  x21: { abi: 's5', group: 'saved', role: '저장 레지스터', desc: 'Saved register 5' },
  x22: { abi: 's6', group: 'saved', role: '저장 레지스터', desc: 'Saved register 6' },
  x23: { abi: 's7', group: 'saved', role: '저장 레지스터', desc: 'Saved register 7' },
  x24: { abi: 's8', group: 'saved', role: '저장 레지스터', desc: 'Saved register 8' },
  x25: { abi: 's9', group: 'saved', role: '저장 레지스터', desc: 'Saved register 9' },
  x26: { abi: 's10', group: 'saved', role: '저장 레지스터', desc: 'Saved register 10' },
  x27: { abi: 's11', group: 'saved', role: '저장 레지스터', desc: 'Saved register 11' },
  x28: { abi: 't3', group: 'temp', role: '임시 레지스터', desc: 'Temporary 3' },
  x29: { abi: 't4', group: 'temp', role: '임시 레지스터', desc: 'Temporary 4' },
  x30: { abi: 't5', group: 'temp', role: '임시 레지스터', desc: 'Temporary 5' },
  x31: { abi: 't6', group: 'temp', role: '임시 레지스터', desc: 'Temporary 6' },
};

const REG_KEYS = Array.from({ length: 32 }, (_, i) => `x${i}`);

const RegisterVisualizer: React.FC<RegisterVisualizerProps> = ({
  registers,
  prevRegisters,
  playSpeed = 1000,
  cycle = 0,
}) => {
  // x0부터 x31까지 고정 순서 (32개)
  const regKeys = REG_KEYS;

  // 새로 값이 쓰인 레지스터에 대해 절반 주기 동안 점등(Flash/Pulse) 상태 유지
  const [pulsingKeys, setPulsingKeys] = useState<Set<string>>(() => new Set());

  const prevRegsRef = React.useRef<Record<string, string> | undefined>(undefined);

  useEffect(() => {
    // 1. 이전 값 기준: prevRegisters prop이 있으면 사용하고, 없으면 ref에 기억된 이전 상태 활용
    const referencePrev = prevRegisters || prevRegsRef.current;
    prevRegsRef.current = registers;

    if (!referencePrev) {
      setPulsingKeys((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    const changed = new Set<string>();
    regKeys.forEach((key) => {
      const currentVal = registers[key] || '0x00000000';
      const prevVal = referencePrev[key];
      // 이전 값이 정의되어 있고 현재 값과 다를 때만 점등
      if (prevVal !== undefined && prevVal !== currentVal) {
        changed.add(key);
      }
    });

    if (changed.size > 0) {
      setPulsingKeys(changed);
      // 속도의 절반(50%) 동안 점등 상태 유지 후 원래 파스텔 색상으로 복귀
      const halfDuration = Math.max(120, Math.round(playSpeed * 0.5));
      const timer = window.setTimeout(() => {
        setPulsingKeys((prev) => (prev.size === 0 ? prev : new Set()));
      }, halfDuration);

      return () => clearTimeout(timer);
    } else {
      setPulsingKeys((prev) => (prev.size === 0 ? prev : new Set()));
    }
  }, [cycle, registers, prevRegisters, playSpeed, regKeys]);

  return (
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden select-none font-mono text-[var(--ar-text-primary)] shadow-sm transition-colors duration-150">
      {/* VS Code VARIABLES / WATCH 스타일 헤더 (레지스터 전용 앰버 액센트 바) */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-amber-500 font-sans">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-amber-500 font-bold">◆</span>
          <h3 className="font-sans text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wide whitespace-nowrap">
            REGISTERS (x0 ~ x31)
          </h3>
        </div>
        <span className="text-[10px] text-[var(--ar-text-muted)] font-mono">
          CLK:{cycle ?? 0}
        </span>
      </div>

      {/* 32개 레지스터 그리드: VS Code 디버거 변수 인스펙터 룩앤필 */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden px-1.5 py-0.5 divide-y divide-[var(--ar-border-subtle)]">
        {regKeys.map((regKey, idx) => {
          const val = registers[regKey] || '0x00000000';
          const isPulsing = pulsingKeys.has(regKey);
          const hasVal = val !== '0x00000000';
          const meta = REGISTER_METAS[regKey] || { abi: regKey, group: 'temp' as RegisterGroup };

          // 그룹 경계선
          const prevMeta = idx > 0 ? REGISTER_METAS[regKeys[idx - 1]] : undefined;
          const isGroupStart = prevMeta && prevMeta.group !== meta.group;

          return (
            <div
              key={regKey}
              title={`${meta.desc || regKey} (Hex: ${val})`}
              className={`flex-1 min-h-0 flex items-center justify-between px-2 text-[11px] transition-colors duration-100 ${
                isGroupStart ? 'border-t border-t-[#D0D7DE] dark:border-t-[#3E3E42]' : ''
              } ${
                isPulsing
                  ? 'bg-[#FFF8C5] dark:bg-[#37373D] text-[#9A6700] dark:text-[#E5B567] font-bold'
                  : hasVal
                  ? 'bg-white dark:bg-[#252526]/50 hover:bg-[#F6F8FA] dark:hover:bg-[#2A2D2E] text-[#1F2328] dark:text-[#D4D4D4]'
                  : 'hover:bg-[#F6F8FA] dark:hover:bg-[#2A2D2E]/50 text-[#656D76] dark:text-[#6E7681]'
              }`}
            >
              {/* 좌측: [ABI 이름] (레지스터 번호) */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`w-7 font-bold ${
                  isPulsing 
                    ? 'text-[#9A6700] dark:text-[#E5B567]' 
                    : hasVal 
                    ? 'text-[#005FB8] dark:text-[#4EC9B0]' 
                    : 'text-[#656D76] dark:text-[#858585]'
                }`}>
                  {meta.abi}
                </span>

                <span className="text-[10px] text-[#8C959F] dark:text-[#6E7681]">
                  ({regKey})
                </span>
              </div>

              {/* 중앙: 레지스터 역할 간략 설명 */}
              <div className="flex-1 min-w-0 px-2 text-left truncate">
                <span className="text-[9.5px] font-sans text-[#8C959F] dark:text-[#858585] tracking-tight">
                  {meta.role}
                </span>
              </div>

              {/* 우측: 부호 있는 10진수 값 (우측 정렬 및 호버 시 16진수 툴팁) */}
              <div
                title={`Hex: ${val}`}
                className="shrink-0 tabular-nums font-mono select-text cursor-help"
              >
                <span
                  className={`text-right text-[11px] font-semibold ${
                    isPulsing
                      ? 'text-[#CF222E] dark:text-[#F44747] font-bold'
                      : hasVal
                      ? 'text-[#005FB8] dark:text-[#79C0FF]'
                      : 'text-[#656D76] dark:text-[#858585]'
                  }`}
                >
                  {formatSignedDec(val)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegisterVisualizer;
