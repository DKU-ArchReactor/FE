import React from 'react';
import type { CycleHistoryItem, SimulationResult } from '@/type/simulation';
import type { CodeLineSelectInfo } from './Source/SourceViewer';
import { PC_TO_C_LINE_MAP } from './Source/SourceViewer';

export interface ExplanationResult {
  action: string;
  summary: string;
  analysis: string;
}

// PC 주소를 기반으로 어셈블리 줄 번호 및 C 소스 줄 번호 추출
const getLineInfoFromPc = (pc?: string | null) => {
  if (!pc) return null;
  const cleanPc = pc.toLowerCase();
  const cLineIndex = PC_TO_C_LINE_MAP[cleanPc];
  const pcNum = parseInt(cleanPc, 16);
  const basePc = 0x00010094;
  let asmLine: number | null = null;
  if (!isNaN(pcNum) && pcNum >= basePc) {
    if (pcNum <= 0x00010134) {
      asmLine = 4 + Math.floor((pcNum - basePc) / 4);
    } else if (pcNum === 0x00010144) {
      asmLine = 45;
    } else if (pcNum === 0x00010148) {
      asmLine = 46;
    } else if (pcNum >= 0x0001014c) {
      asmLine = 47 + Math.floor((pcNum - 0x0001014c) / 4);
    }
  }
  return {
    asmLine,
    cLine: cLineIndex !== undefined ? cLineIndex + 1 : null,
  };
};

export interface TutorAreaProps {
  simulationData: SimulationResult | null;
  currentCycleData: CycleHistoryItem | null;
  selectedCodeLine?: CodeLineSelectInfo | null;
  onClearSelectedCodeLine?: () => void;
}

const TutorArea: React.FC<TutorAreaProps> = ({
  simulationData,
  currentCycleData,
  selectedCodeLine,
  onClearSelectedCodeLine,
}) => {
  if (!simulationData || !currentCycleData) {
    return (
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col items-center justify-center text-center text-slate-400">
        시뮬레이션 대기 중...
      </div>
    );
  }

  const { cycle_events, global_result } = currentCycleData;
  const metrics = global_result.metrics;

  // 현재 사이클 해설 생성
  const getCycleExplanation = () => {
    if (cycle_events.stall?.has_stall) {
      return {
        title: '⚠️ 데이터 해저드 (Data Hazard Stall)',
        desc:
          cycle_events.stall.stall_desc ||
          `${cycle_events.stall.stage} 단계에서 필요한 레지스터 값이 아직 계산되지 않아 1사이클 정지(Stall)가 발생했습니다.`,
        type: 'danger',
      };
    }
    if (cycle_events.forwarding?.has_forwarded) {
      return {
        title: '⚡ 데이터 포워딩 (Data Forwarding)',
        desc:
          cycle_events.forwarding.forwarding_desc ||
          `레지스터 쓰기(WB)를 기다리지 않고, ALU 실행 결과를 다음 명령어의 입력으로 직접 우회 전달(Forwarding)하여 Stall을 방지했습니다.`,
        type: 'info',
      };
    }
    if (cycle_events.control_hazard?.has_flush) {
      return {
        title: '🔄 제어 해저드 (Control Hazard / Flush)',
        desc:
          cycle_events.control_hazard.flush_reason ||
          '분기(Branch/Jump) 예측 결과와 달라 파이프라인에 미리 들어와 있던 잘못된 명령어들을 비우고(Flush) 올바른 주소로 PC를 변경했습니다.',
        type: 'warning',
      };
    }
    return {
      title: '✅ 정상 파이프라인 진행 (Normal Execution)',
      desc: '각 파이프라인 단계에서 명령어들이 1클록 단위로 지연 없이 순조롭게 다음 단계로 이동하고 있습니다.',
      type: 'success',
    };
  };

  // IF 단계 명령어 추출 및 자연어 해설 생성
  const ifBuffer = currentCycleData.buffers?.IF || currentCycleData.if_stage;
  const ifAssembly = ifBuffer?.assembly || 'bubble';
  const ifPc = ifBuffer?.pc;

  const explainInstruction = (inst: string): ExplanationResult => {
    if (!inst || inst === 'bubble' || inst === 'empty') {
      return {
        action: '파이프라인 버블 (대기)',
        summary: '현재 클록에 새로 인입된 명령어가 없습니다 (스톨 또는 분기 플러시 상태).',
        analysis: '파이프라인 지연(Stall) 또는 분기 예측 실패(Flush)로 인해 NOP(No-operation) 버블이 삽입되어 하드웨어 자원을 비워둔 채 1사이클 전진합니다.'
      };
    }

    const trimmed = inst.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
      return {
        action: '주석 (Comment)',
        summary: '소스 코드 이해를 돕기 위해 작성된 설명문입니다.',
        analysis: '어셈블러가 기계어로 번역하지 않고 건너뛰므로 프로세서 레지스터나 메모리 상태에 아무런 영향을 주지 않습니다.'
      };
    }
    if (trimmed.endsWith(':')) {
      return {
        action: `코드 레이블 (${trimmed})`,
        summary: '함수 또는 분기/점프 목적지의 시작 위치를 나타내는 심볼 레이블입니다.',
        analysis: '어셈블러와 링커가 해당 심볼의 메모리 주소(PC)를 심볼 테이블에 등록하며, 분기 명령어(JAL, BNE 등)가 이 주소를 참조하여 점프합니다.'
      };
    }
    if (trimmed.startsWith('.')) {
      return {
        action: `어셈블러 지시어 (${trimmed})`,
        summary: '어셈블러에게 심볼 범위나 섹션 배치를 알리는 지시어입니다.',
        analysis: '예컨대 .globl main은 main 심볼을 외부 링커가 찾을 수 있도록 전역으로 공개(Export)하여 실행 파일의 진입점을 구성합니다.'
      };
    }

    const parts = trimmed.split(/[\s,]+/);
    const op = parts[0]?.toLowerCase();

    switch (op) {
      case 'addi':
        if (parts[1] === 'sp' && parts[2] === 'sp') {
          const imm = parseInt(parts[3], 10);
          if (imm < 0) {
            return {
              action: '스택 프레임 공간 할당 (함수 프롤로그)',
              summary: `스택 포인터(sp)를 ${Math.abs(imm)}바이트 감소시켜 지역 변수 및 반환 주소 저장 공간을 확보합니다.`,
              analysis: `RISC-V 스택은 높은 주소에서 낮은 주소로 자라납니다. 함수 시작 시 음수 오프셋(${imm})을 더해 스택 포인터(sp)를 아래로 내려 ra(복귀 주소)와 지역 변수들(a, b, c, d)을 보관할 안전한 프레임을 구축합니다.`
            };
          } else {
            return {
              action: '스택 프레임 공간 해제 (함수 에필로그)',
              summary: `스택 포인터(sp)를 ${imm}바이트 증가시켜 할당했던 스택 공간을 정리하고 복원합니다.`,
              analysis: `함수 종료 직전, 함수 프롤로그에서 할당했던 스택 프레임을 호출자(Caller)의 원래 위치로 되돌리기 위해 sp에 ${imm}을 더하여 정리합니다. 직후 ret/jalr로 안전하게 복귀할 수 있습니다.`
            };
          }
        }
        if (parts[2] === 'zero') {
          return {
            action: '상수값 레지스터 적재 (Immediate Load)',
            summary: `상수 ${parts[3]}을 ${parts[1]} 레지스터에 대입합니다.`,
            analysis: `zero(x0) 레지스터는 항상 0으로 고정되어 있으므로, 'addi ${parts[1]}, zero, ${parts[3]}'은 실질적으로 '${parts[1]} = ${parts[3]}' 대입 연산을 수행하는 RISC-V 의사명령어(li)의 표준 구현 패턴입니다.`
          };
        }
        return {
          action: '즉시값 덧셈 (Add Immediate)',
          summary: `${parts[2] || '연산자'} 값에 상수 ${parts[3] || '값'}을 더하여 ${parts[1] || '대상'} 레지스터에 저장합니다.`,
          analysis: `I-Type 명령어 규격으로, ALU의 가산기를 통해 레지스터 데이터와 12비트 부호 확장 즉시값을 연산합니다. 연산 결과는 최종 WB(Write-Back) 단계에서 ${parts[1]} 레지스터에 반영됩니다.`
        };

      case 'add':
        return {
          action: '레지스터 정수 덧셈 (Add)',
          summary: `${parts[2]} 레지스터와 ${parts[3]} 레지스터의 값을 더하여 ${parts[1]}에 저장합니다.`,
          analysis: `R-Type 형식으로 ALU의 32비트 가산기에서 두 레지스터 값을 병렬 덧셈합니다. 오버플로 예외를 발생시키지 않고 하위 32비트 연산 결과를 대상 레지스터에 기록합니다.`
        };

      case 'sub':
        return {
          action: '레지스터 정수 뺄셈 (Subtract)',
          summary: `${parts[2]} 레지스터 값에서 ${parts[3]} 값을 빼서 ${parts[1]}에 저장합니다.`,
          analysis: `ALU의 2의 보수 가산/감산 유닛을 사용하여 두 레지스터의 차를 연산합니다. 변수 간의 차이 계산 또는 조건 검사 직전의 비교 베이스 값 생성에 사용됩니다.`
        };

      case 'mul':
        return {
          action: '정수 곱셈 연산 (Multiply)',
          summary: `${parts[2]}와 ${parts[3]} 레지스터의 정수 곱을 계산하여 ${parts[1]}에 저장합니다.`,
          analysis: `RISC-V M-확장(표준 곱셈기)을 통해 32비트 곱셈의 하위 32비트 결과를 계산합니다. 덧셈보다 하드웨어 레이턴시가 길어 파이프라인 데이터 해저드에 유의해야 합니다.`
        };

      case 'div':
        return {
          action: '정수 나눗셈 연산 (Divide)',
          summary: `${parts[2]} 레지스터를 ${parts[3]} 값으로 나눈 몫을 계산하여 ${parts[1]}에 저장합니다.`,
          analysis: `RISC-V M-확장 나눗셈 연산입니다. 제수가 0인 경우(Zero Division) 하드웨어 트랩 대신 전비트 1(-1)이 결과로 반환되므로, 시뮬레이션 및 소프트웨어 로직에서 0 나누기 예외 처리를 검증하는 핵심 명령어입니다.`
        };

      case 'lui':
        return {
          action: '상위 20비트 즉시값 로드 (Load Upper Immediate)',
          summary: `${parts[1]} 레지스터의 상위 20비트(bits 31:12)에 상수 ${parts[2]}을 로드합니다.`,
          analysis: `U-Type 명령어로, 32비트 주소나 큰 상수를 단일 명령어로 적재할 수 없는 RISC-V 구조에서 lui로 상위 20비트를 채우고 뒤이어 addi로 하위 12비트를 합성하는 2단계 상수 로드 패턴(lui + addi)을 형성합니다.`
        };

      case 'sw': {
        const memMatch = trimmed.match(/sw\s+([a-zA-Z0-9]+)\s*,\s*(-?\d+)\s*\(([a-zA-Z0-9]+)\)/);
        if (memMatch) {
          const reg = memMatch[1];
          const offset = memMatch[2];
          const base = memMatch[3];
          return {
            action: '메모리 저장 (Store Word)',
            summary: `${reg} 레지스터의 32비트 데이터를 메모리 주소 [${base} + ${offset}] 위치에 저장합니다.`,
            analysis: `S-Type 명령어로, EX 단계에서 [${base} + ${offset}] 유효 주소를 계산한 후 MEM 단계에서 ${reg} 레지스터의 4바이트 워드를 데이터 메모리(스택)에 씁니다. 함수 반환 주소(ra)나 지역 변수를 메모리에 백업할 때 필수적입니다.`
          };
        }
        return {
          action: '메모리 저장 (Store Word)',
          summary: '레지스터의 값을 데이터 메모리 주소에 기록(Store)합니다.',
          analysis: 'EX 단계에서 기저 레지스터와 오프셋을 더해 유효 주소를 계산하고, MEM 단계에서 4바이트 워드 데이터를 메모리에 씁니다.'
        };
      }

      case 'lw': {
        const memMatch = trimmed.match(/lw\s+([a-zA-Z0-9]+)\s*,\s*(-?\d+)\s*\(([a-zA-Z0-9]+)\)/);
        if (memMatch) {
          const reg = memMatch[1];
          const offset = memMatch[2];
          const base = memMatch[3];
          return {
            action: '메모리 읽기 (Load Word)',
            summary: `메모리 주소 [${base} + ${offset}]에서 32비트 데이터를 읽어와 ${reg} 레지스터에 적재합니다.`,
            analysis: `I-Type 명령어로, MEM 단계에서 SRAM/스택 메모리로부터 데이터를 페치합니다. 바로 다음 명령어가 ${reg} 레지스터를 참조할 경우 Load-Use 데이터 해저드가 발생하여 1사이클 정지(Stall)가 일어날 수 있습니다.`
          };
        }
        return {
          action: '메모리 읽기 (Load Word)',
          summary: '데이터 메모리에서 값을 읽어 대상 레지스터에 적재(Load)합니다.',
          analysis: 'MEM 단계에서 메모리로부터 4바이트를 읽어와 WB 단계에서 대상 레지스터 파일에 최종 기록합니다.'
        };
      }

      case 'beq':
        return {
          action: '같을 시 조건 분기 (Branch if Equal)',
          summary: `${parts[1]} 레지스터와 ${parts[2]} 레지스터의 값이 같으면 오프셋(${parts[3]}) 위치로 분기합니다.`,
          analysis: `B-Type 명령어로, ALU에서 두 레지스터의 감산 결과가 0인지 판별합니다. 조건 만족(Taken) 시 분기 목적지로 PC를 갱신하며, 이미 파이프라인에 진입한 잘못된 명령어들을 비우는 제어 해저드(Flush)가 일어납니다.`
        };

      case 'bne':
        return {
          action: '다를 시 조건 분기 (Branch if Not Equal)',
          summary: `${parts[1]} 레지스터와 ${parts[2]} 레지스터의 값이 서로 다르면 오프셋(${parts[3]}) 위치로 분기합니다.`,
          analysis: `B-Type 명령어로, 두 레지스터 값이 상이할 때 분기합니다. 루프 탈출 조건문 또는 if 검증에서 참/거짓 판단 흐름을 제어하는 핵심 분기 명령어입니다.`
        };

      case 'jal':
        return {
          action: '함수 호출 및 점프 (Jump and Link)',
          summary: `다음 복귀 주소(PC+4)를 ${parts[1] || 'ra'} 레지스터에 저장하고 지정된 함수 주소로 점프합니다.`,
          analysis: `J-Type 무조건 점프 명령어로, 서브루틴 호출 시 호출 지점의 다음 명령어 주소를 링크 레지스터(ra)에 안전하게 저장하여 함수 종료 후 되돌아올 수 있는 기반을 마련합니다.`
        };

      case 'jalr':
        if (parts[2] === 'ra') {
          return {
            action: '함수 복귀 (Return via JALR)',
            summary: '복귀 주소 레지스터(ra)에 저장된 호출 지점으로 복귀하여 함수 실행을 종료합니다.',
            analysis: 'I-Type 간접 점프 명령어로, ra 레지스터의 주소로 PC를 변경하여 Caller 함수로 되돌아갑니다. C 언어의 return 구문이 어셈블리로 번역된 최종 형태입니다.'
          };
        }
        return {
          action: '레지스터 간접 점프 (Jump and Link Register)',
          summary: `${parts[2]} 레지스터의 주소로 점프하고 복귀 주소를 ${parts[1]}에 기록합니다.`,
          analysis: '동적 함수 포인터 호출이나 원거리 절대 주소 점프에 활용되는 I-Type 분기 명령어입니다.'
        };

      case 'sltiu':
        return {
          action: '부호 없는 즉시값 비교 (Set Less Than Imm Unsigned)',
          summary: `${parts[2]}의 부호 없는 값이 상수 ${parts[3]}보다 작으면 1, 크거나 같으면 0을 ${parts[1]}에 기록합니다.`,
          analysis: `C 언어의 일치 조건(==)을 컴파일할 때, 기준값을 감산한 결과가 0인지 검사하기 위해 'sltiu rd, rs, 1'을 수행하여 rs가 0일 때만 1(참)을 반환하는 컴파일러 최적화 패턴입니다.`
        };

      case 'and':
        return {
          action: '비트 단위 논리곱 (Bitwise AND)',
          summary: `${parts[2]}와 ${parts[3]}의 비트 논리곱(AND)을 계산하여 ${parts[1]}에 저장합니다.`,
          analysis: `ALU의 논리 연산 유닛에서 비트 단위 AND를 수행합니다. 복합 조건문(a == 50 && b == 100)에서 각 조건의 참/거짓 플래그를 결합하여 최종 참 여부를 판별할 때 활용됩니다.`
        };

      case 'or':
        return {
          action: '비트 단위 논리합 (Bitwise OR)',
          summary: `${parts[2]}와 ${parts[3]}의 비트 논리합(OR)을 계산하여 ${parts[1]}에 저장합니다.`,
          analysis: `두 피연산자의 각 비트 중 하나라도 1이면 1을 결과로 산출합니다. 비트 마스크 합성 및 논리 OR 판별에 쓰입니다.`
        };

      case 'ecall':
        return {
          action: '운영체제 시스템 호출 (Environment Call)',
          summary: '사용자 모드에서 운영체제 커널의 시스템 콜 핸들러를 호출합니다.',
          analysis: `소프트웨어 인터럽트(트랩)를 발생시켜 커널 모드로 문맥을 전환합니다. a7 레지스터의 서비스 번호(4=콘솔 문자열 출력 printf, 10=프로세스 정상 종료 exit)에 따라 OS가 요청을 대행합니다.`
        };

      case 'ret':
        return {
          action: '함수 복귀 (Return)',
          summary: '현재 함수의 실행을 마치고 함수를 호출한 위치(Caller)로 복귀합니다.',
          analysis: 'jalr zero, ra, 0의 표준 의사명령어로, 링크 레지스터(ra)에 저장된 복귀 주소로 즉시 점프하여 제어권을 이전 함수로 넘깁니다.'
        };

      case 'nop':
        return {
          action: '동작 없음 (No Operation)',
          summary: '아무 연산도 수행하지 않고 다음 사이클로 전진합니다.',
          analysis: 'addi x0, x0, 0 형태의 의사명령어로, 레지스터 상태 변화 없이 파이프라인 타이밍 조율이나 지연 슬롯을 메우는 데 사용됩니다.'
        };

      default:
        return {
          action: '명령어 실행',
          summary: `${inst} 명령어를 페치하여 다음 디코드(ID) 단계로 전달합니다.`,
          analysis: `파이프라인 회로에서 ${inst} 명령어가 순차적으로 디코드되어 ALU 및 제어 신호로 분기됩니다.`
        };
    }
  };

  const explainCLine = (line: string): ExplanationResult => {
    const trimmed = line.trim();
    if (!trimmed) {
      return {
        action: '공백 라인',
        summary: '내용이 없는 빈 줄입니다.',
        analysis: '코드 가독성을 위한 빈 줄로 컴파일 대상에서 제외됩니다.'
      };
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      return {
        action: 'C 소스 주석 (Comment)',
        summary: '코드 로직 이해를 돕기 위한 주석 구문입니다.',
        analysis: '전처리기 및 컴파일러 단계에서 제거되어 머신 코드로 번역되지 않습니다.'
      };
    }
    if (trimmed.startsWith('#include')) {
      return {
        action: '표준 라이브러리 헤더 포함',
        summary: '표준 입출력 라이브러리(stdio.h) 함수 정의를 포함합니다.',
        analysis: 'printf 등의 표준 I/O 함수 프로토타입을 선언하여 컴파일러가 입출력 함수 호출의 인자 타입과 반환값을 검증할 수 있도록 합니다.'
      };
    }
    if (trimmed.includes('int main')) {
      return {
        action: 'main() 함수 진입점 선언',
        summary: '프로그램 실행 시 가장 먼저 호출되는 메인 진입점 함수입니다.',
        analysis: '어셈블리에서는 .globl main 심볼로 등록되며, 호출 직후 스택 포인터를 감소시키는 함수 프롤로그(addi sp, sp, -48)가 생성됩니다.'
      };
    }
    if (trimmed.includes('return')) {
      return {
        action: '함수 종료 및 상태 코드 반환 (return)',
        summary: 'main 함수의 결과 코드(0)를 반환하고 프로그램을 정상 종료합니다.',
        analysis: '반환값 0은 a0 레지스터에 저장되고, 스택 프레임을 해제한 뒤 jalr zero, ra, 0을 통해 운영체제 환경으로 제어권을 돌려줍니다.'
      };
    }
    if (trimmed.includes('printf')) {
      return {
        action: '문자열 콘솔 출력 (printf)',
        summary: '포맷 문자열을 화면에 출력하기 위해 OS 시스템 콜을 호출합니다.',
        analysis: '출력할 문자열의 메모리 주소를 a0 레지스터에 적재하고, 서비스 번호 4(문자열 출력)를 a7에 설정한 뒤 ecall 트랩을 실행하여 콘솔에 출력합니다.'
      };
    }
    if (trimmed.includes('if')) {
      return {
        action: '복합 논리 조건 분기문 (if)',
        summary: '조건식이 참인지 판별하여 조건부 코드 블록의 실행 여부를 결정합니다.',
        analysis: '어셈블리에서는 각 변수(a, b)의 기준값 비교(addi, sltiu)와 논리곱(and)을 거쳐 beq/bne 분기 명령어로 변환되어 실행 흐름을 제어합니다.'
      };
    }
    if (trimmed.includes('/')) {
      return {
        action: '정수 나눗셈 연산 (Zero Division Test)',
        summary: '변수 c(500)를 d(0)으로 나누는 정수 나눗셈을 수행합니다.',
        analysis: '하드웨어 나눗셈(div) 명령어로 변환되어 실행되며, 제수가 0인 경우의 예외 처리와 프로세서 파이프라인의 연산 처리 결과를 검증하는 핵심 코드입니다.'
      };
    }
    if (trimmed.includes('int ')) {
      return {
        action: '정수형 지역 변수 선언 및 초기값 대입',
        summary: `${trimmed} 구문으로 지역 변수를 정의하고 초기값을 할당합니다.`,
        analysis: '컴파일러는 상수값을 레지스터에 올린 뒤(addi), 스택 프레임의 특정 오프셋 주소(예: sw a5, 16(sp))에 저장하여 변수의 메모리 공간을 유지합니다.'
      };
    }
    return {
      action: 'C 언어 구문 실행',
      summary: `${trimmed} 구문입니다.`,
      analysis: '컴파일러에 의해 하나 이상의 RISC-V 어셈블리 명령어 시퀀스로 변환되어 파이프라인에서 순차 실행됩니다.'
    };
  };

  const instExplanation = explainInstruction(ifAssembly);
  const explanation = getCycleExplanation();
  const ifLineInfo = getLineInfoFromPc(ifPc);

  const selectedExplanation = selectedCodeLine
    ? selectedCodeLine.tab === 'asm'
      ? explainInstruction(selectedCodeLine.instruction || selectedCodeLine.text)
      : explainCLine(selectedCodeLine.text)
    : null;

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-3.5 flex flex-col gap-3 overflow-y-auto min-h-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-800">ArchReactor Tutor</h2>
        </div>
      </div>

      {/* 📌 더블클릭으로 선택한 코드 상세 해설 카드 */}
      {selectedCodeLine && selectedExplanation && (
        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/70 text-xs flex flex-col gap-2.5 shrink-0 shadow-xs ring-2 ring-indigo-400/30">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 text-white font-sans tracking-wide">
                {selectedCodeLine.tab === 'asm' ? '📌 선택한 어셈블리' : '📌 선택한 C 코드'}
              </span>
              <span className="text-[10px] font-mono text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded font-bold border border-indigo-200">
                {selectedCodeLine.tab === 'asm' 
                  ? `ASM ${selectedCodeLine.lineIndex + 1}번째 줄` 
                  : `C 소스 ${selectedCodeLine.lineIndex + 1}번째 줄`}
              </span>
              {selectedCodeLine.pc && (
                <span className="text-[10px] font-mono text-slate-500 font-semibold ml-auto">
                  PC: {selectedCodeLine.pc}
                </span>
              )}
            </div>
            {onClearSelectedCodeLine && (
              <button
                onClick={onClearSelectedCodeLine}
                className="text-slate-400 hover:text-slate-700 text-xs p-0.5 rounded ml-auto"
                title="닫기"
              >
                ✕
              </button>
            )}
          </div>

          <div className="font-mono font-bold text-slate-800 text-xs px-2.5 py-1.5 rounded bg-white border border-indigo-100 shadow-2xs">
            {selectedCodeLine.text.trim()}
          </div>

          <div>
            <div className="font-bold text-xs text-indigo-950 mb-0.5">
              {selectedExplanation.action}
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed mb-2">
              {selectedExplanation.summary}
            </p>

            {/* 🔍 상세 분석 섹션 */}
            <div className="p-2.5 rounded-lg bg-white/90 border border-indigo-100 text-[11px] shadow-2xs">
              <div className="flex items-center gap-1 font-bold text-indigo-900 mb-1">
                <span>🔍</span>
                <span>상세 분석</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {selectedExplanation.analysis}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 1. 현재 IF 단계 인입 명령어 해설 카드 */}
      <div className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/50 text-xs flex flex-col gap-2 shrink-0 shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white font-sans tracking-wide">
            IF 단계
          </span>
          {ifLineInfo?.asmLine && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
              ASM {ifLineInfo.asmLine}번째 줄
            </span>
          )}
          {ifLineInfo?.cLine && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              C 소스 {ifLineInfo.cLine}번째 줄 연계
            </span>
          )}
          {ifPc && (
            <span className="text-[10px] font-mono text-slate-500 font-semibold ml-auto">
              PC: {ifPc}
            </span>
          )}
        </div>

        <div className="font-mono font-bold text-slate-800 text-xs px-2.5 py-1.5 rounded bg-white border border-rose-100 shadow-2xs">
          {ifAssembly}
        </div>

        <div>
          <div className="font-bold text-xs text-rose-950 mb-0.5">
            {instExplanation.action}
          </div>
          <p className="text-[11px] text-slate-700 leading-relaxed mb-2">
            {instExplanation.summary}
          </p>

          {/* 🔍 상세 분석 섹션 */}
          <div className="p-2.5 rounded-lg bg-white/90 border border-rose-100 text-[11px] shadow-2xs">
            <div className="flex items-center gap-1 font-bold text-rose-900 mb-1">
              <span>🔍</span>
              <span>상세 분석</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {instExplanation.analysis}
            </p>
          </div>
        </div>
      </div>

      {/* 2. 현재 사이클 분석 카드 (스톨 / 포워딩 / 정상 진행) */}
      <div
        className={`p-3 rounded-xl border text-xs leading-relaxed shrink-0 ${
          explanation.type === 'danger'
            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
            : explanation.type === 'warning'
            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
            : explanation.type === 'info'
            ? 'bg-cyan-50/70 border-cyan-200 text-cyan-900'
            : 'bg-blue-50/50 border-blue-100 text-slate-800'
        }`}
      >
        <div className="font-bold text-xs mb-1">{explanation.title}</div>
        <p className="text-[11px] opacity-90">{explanation.desc}</p>
      </div>

      {/* 실시간 실행 메트릭 통계 */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] text-slate-400">누적 Stall 횟수</span>
            <div className="text-base font-bold font-mono text-rose-600 mt-0.5">
              {metrics.accumulated_stalls} 회
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] text-slate-400">누적 Forwarding</span>
            <div className="text-base font-bold font-mono text-cyan-600 mt-0.5">
              {metrics.accumulated_forwards} 회
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorArea;
