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

// 레지스터 역할별 그룹 스타일 정의: 기본은 깨끗한 흰색(bg-white), 값이 들어있는 곳만 구역별 연한 파스텔 배경
type RegisterGroup = 'zero' | 'special' | 'args' | 'saved' | 'temp';

interface RegisterGroupStyle {
  label: string;
  textColor: string;
  activeBg: string; // 기본 상태에서 값이 들어있을 때의 구역별 연한 파스텔톤 배경
  pulseBg: string;  // 값이 새로 쓰이는 전반부(50% 주기) 동안 반짝 점등되는 하이라이트 배경
}

const REGISTER_GROUP_STYLES: Record<RegisterGroup, RegisterGroupStyle> = {
  zero: {
    label: 'Zero',
    textColor: 'text-slate-600 font-bold',
    activeBg: 'bg-slate-100 hover:bg-slate-200/80',
    pulseBg: 'bg-slate-200 text-slate-900 font-bold',
  },
  special: {
    // ra, sp, gp, tp: 세련된 파스텔 로즈
    label: 'Special',
    textColor: 'text-rose-600 font-bold',
    activeBg: 'bg-rose-50/80 hover:bg-rose-100/70',
    pulseBg: 'bg-rose-200/90 text-rose-950 font-bold',
  },
  args: {
    // a0 ~ a7 (함수 인자): 맑고 청량한 파스텔 블루
    label: 'Args',
    textColor: 'text-blue-600 font-bold',
    activeBg: 'bg-blue-50/80 hover:bg-blue-100/70',
    pulseBg: 'bg-blue-200/90 text-blue-950 font-bold',
  },
  saved: {
    // s0 ~ s11 (보존 레지스터): 편안한 파스텔 틸/민트
    label: 'Saved',
    textColor: 'text-teal-700 font-bold',
    activeBg: 'bg-teal-50/80 hover:bg-teal-100/70',
    pulseBg: 'bg-teal-200/90 text-teal-950 font-bold',
  },
  temp: {
    // t0 ~ t6 (임시 레지스터): 부드러운 파스텔 앰버/피치
    label: 'Temp',
    textColor: 'text-amber-700 font-bold',
    activeBg: 'bg-amber-50/80 hover:bg-amber-100/70',
    pulseBg: 'bg-amber-200/90 text-amber-950 font-bold',
  },
};

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
    <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200 flex flex-col min-h-0 overflow-hidden select-none">
      {/* 통일된 상단 헤더 바 */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-slate-50/80 border-b border-slate-200/80 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs">📋</span>
          <h3 className="text-xs font-bold text-slate-800 whitespace-nowrap">Registers</h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 font-semibold">x0 ~ x31</span>
      </div>

      {/* 32개 레지스터: 전체 가용 높이를 1/32로 균등 분할(flex-1 min-h-0)하여 스크롤 없이 100% 핏 */}
      <div className="flex-1 flex flex-col font-mono min-h-0 overflow-hidden px-1.5 py-1">
        {regKeys.map((regKey, idx) => {
          const val = registers[regKey] || '0x00000000';
          const isPulsing = pulsingKeys.has(regKey);
          const hasVal = val !== '0x00000000';
          const meta = REGISTER_METAS[regKey] || { abi: regKey, group: 'temp' as RegisterGroup };
          const groupStyle = REGISTER_GROUP_STYLES[meta.group];

          // 그룹이 바뀌는 경계선(Chunk Divider): 상단 1px 구분선 (일반 행은 1px 경계선)
          const prevMeta = idx > 0 ? REGISTER_METAS[regKeys[idx - 1]] : undefined;
          const isGroupStart = prevMeta && prevMeta.group !== meta.group;

          return (
            <div
              key={regKey}
              title={`${meta.desc || regKey} (Hex: ${val})`}
              className={`flex-1 min-h-0 flex items-center justify-between px-2.5 transition-colors duration-200 border-b border-slate-100 ${
                isGroupStart ? 'border-t border-t-slate-300' : ''
              } ${
                isPulsing
                  ? groupStyle.pulseBg
                  : hasVal
                  ? `${groupStyle.activeBg} text-slate-900 font-medium`
                  : 'bg-white hover:bg-slate-50/70 text-slate-400'
              }`}
            >
              {/* 좌측: [ABI 이름 크게] + [레지스터 번호] + [태그] */}
              <div className="flex items-center gap-1.5 min-w-0">
                {/* 1. ABI 이름 (a0, s0, t0, sp 등) - 동그라미 제거 & 폰트 크기 12.5px로 시원하게 확대 */}
                <span className={`w-8 text-[12.5px] font-mono tracking-tight ${
                  isPulsing ? 'font-black' : groupStyle.textColor
                }`}>
                  {meta.abi}
                </span>

                {/* 2. 하드웨어 레지스터 번호 (x0 ~ x31) - 서브 라벨 */}
                <span className={`w-6 text-[10px] font-mono ${
                  isPulsing ? 'font-bold' : hasVal ? 'text-slate-500 font-semibold' : 'text-slate-400'
                }`}>
                  {regKey}
                </span>

                {/* 3. 사전 설정 태그 (Init SP, Fixed 0 등) */}
                {meta.presetTag && (
                  <span className="text-[7.5px] px-1 py-0.2 rounded font-sans font-bold bg-white/80 text-purple-700 shadow-2xs border border-purple-200 shrink-0 leading-none">
                    {meta.presetTag}
                  </span>
                )}
              </div>

              {/* 우측: 10진수 값 (폰트 크기 12px) */}
              <div
                title={`Hex: ${val} (Unsigned: ${parseInt(val, 16) || 0})`}
                className="flex items-center gap-2 shrink-0 cursor-help"
              >
                <span className={`font-mono text-[12px] tracking-wide ${
                  isPulsing
                    ? 'font-black'
                    : hasVal
                    ? 'text-slate-950 font-bold'
                    : 'text-slate-400'
                }`}>
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
