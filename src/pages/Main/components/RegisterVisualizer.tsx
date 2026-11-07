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

// 레지스터 메타데이터: ABI 이름, 특수 목적 및 사전 배정 여부
interface RegisterMeta {
  abi: string;
  group: RegisterGroup;
  desc?: string;
  isPreset?: boolean;
  presetTag?: string;
}

const REGISTER_METAS: Record<string, RegisterMeta> = {
  x0: { abi: 'zero', group: 'zero', desc: 'Hardwired 0 (항상 0 고정)', isPreset: true, presetTag: 'Fixed 0' },
  x1: { abi: 'ra', group: 'special', desc: 'Return Address (함수 반환 주소)' },
  x2: { abi: 'sp', group: 'special', desc: 'Stack Pointer (초기 스택 포인터: 0x7FFFEFFC)', isPreset: true, presetTag: 'Init SP' },
  x3: { abi: 'gp', group: 'special', desc: 'Global Pointer (전역 포인터)' },
  x4: { abi: 'tp', group: 'special', desc: 'Thread Pointer (스레드 포인터)' },
  x5: { abi: 't0', group: 'temp', desc: 'Temporary (임시)' },
  x6: { abi: 't1', group: 'temp', desc: 'Temporary (임시)' },
  x7: { abi: 't2', group: 'temp', desc: 'Temporary (임시)' },
  x8: { abi: 's0', group: 'saved', desc: 'Saved / Frame Pointer' },
  x9: { abi: 's1', group: 'saved', desc: 'Saved register' },
  x10: { abi: 'a0', group: 'args', desc: 'Function argument / Return value' },
  x11: { abi: 'a1', group: 'args', desc: 'Function argument / Return value' },
  x12: { abi: 'a2', group: 'args', desc: 'Function argument' },
  x13: { abi: 'a3', group: 'args', desc: 'Function argument' },
  x14: { abi: 'a4', group: 'args', desc: 'Function argument' },
  x15: { abi: 'a5', group: 'args', desc: 'Function argument' },
  x16: { abi: 'a6', group: 'args', desc: 'Function argument' },
  x17: { abi: 'a7', group: 'args', desc: 'Function argument' },
  x18: { abi: 's2', group: 'saved', desc: 'Saved register' },
  x19: { abi: 's3', group: 'saved', desc: 'Saved register' },
  x20: { abi: 's4', group: 'saved', desc: 'Saved register' },
  x21: { abi: 's5', group: 'saved', desc: 'Saved register' },
  x22: { abi: 's6', group: 'saved', desc: 'Saved register' },
  x23: { abi: 's7', group: 'saved', desc: 'Saved register' },
  x24: { abi: 's8', group: 'saved', desc: 'Saved register' },
  x25: { abi: 's9', group: 'saved', desc: 'Saved register' },
  x26: { abi: 's10', group: 'saved', desc: 'Saved register' },
  x27: { abi: 's11', group: 'saved', desc: 'Saved register' },
  x28: { abi: 't3', group: 'temp', desc: 'Temporary' },
  x29: { abi: 't4', group: 'temp', desc: 'Temporary' },
  x30: { abi: 't5', group: 'temp', desc: 'Temporary' },
  x31: { abi: 't6', group: 'temp', desc: 'Temporary' },
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
    <div className="flex-1 bg-[var(--ar-panel-bg)] rounded-lg border border-[var(--ar-border)] flex flex-col min-h-0 overflow-hidden select-none font-mono text-[var(--ar-text-primary)] shadow-xs transition-colors duration-150">
      {/* VS Code VARIABLES / WATCH 스타일 헤더 (레지스터 전용 앰버 액센트 바) */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-[var(--ar-header-bg)] border-b border-[var(--ar-border)] min-w-0 border-l-2 border-l-amber-500">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] text-amber-500 font-bold">◆</span>
          <h3 className="text-[11px] font-semibold text-[var(--ar-text-primary)] uppercase tracking-wider whitespace-nowrap">
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
              {/* 좌측: [ABI 이름] : [레지스터 번호] */}
              <div className="flex items-center gap-1.5 min-w-0">
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

                {meta.presetTag && (
                  <span className="text-[8px] px-1 py-0.1 rounded font-sans bg-[#EAEAEA] dark:bg-[#333333] text-[#005FB8] dark:text-[#9CDCFE] border border-[#D0D7DE] dark:border-[#454545] shrink-0 leading-none">
                    {meta.presetTag}
                  </span>
                )}
              </div>

              {/* 우측: 10진수 & 16진수 값 매핑 (위치 고정 및 0 (0x...) 순서) */}
              <div
                title={`Dec: ${formatSignedDec(val)}, Hex: ${val}`}
                className="flex items-center gap-1.5 shrink-0 tabular-nums font-mono select-text"
              >
                <span
                  className={`w-28 text-right text-[10px] font-semibold ${
                    isPulsing
                      ? 'text-[#CF222E] dark:text-[#F44747] font-bold'
                      : hasVal
                      ? 'text-[#005FB8] dark:text-[#79C0FF]'
                      : 'text-[#656D76] dark:text-[#858585]'
                  }`}
                >
                  {formatSignedDec(val)}
                </span>
                <span
                  className={`w-[88px] text-right text-[10px] ${
                    isPulsing
                      ? 'text-[#9A6700] dark:text-[#E5B567] font-bold'
                      : hasVal
                      ? 'text-[#953800] dark:text-[#CE9178]'
                      : 'text-[#8C959F] dark:text-[#5A5A5A]'
                  }`}
                >
                  ({val})
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
