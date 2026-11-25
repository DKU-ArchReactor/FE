import type {CycleEvents,CycleHistoryItem} from '@/type/simulation';

const abiNames=['zero','ra','sp','gp','tp','t0','t1','t2','s0','s1','a0','a1','a2','a3','a4','a5','a6','a7','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','t3','t4','t5','t6'];
export function tutorRegisterName(register:string){
  const index=/^x(?:[12]?\d|3[01])$/.test(register)?Number(register.slice(1)):abiNames.indexOf(register);
  if(index<0)return register;
  const role=index===0?' · 항상 0':index===1?' · 함수에서 돌아갈 주소':index===2?' · 스택 위치를 가리키는 주소':'';
  return `${abiNames[index]} (x${index}${role})`;
}

/** Compatibility for older API wording, shared by summaries and detail pages. */
export function tutorPlainText(text:string){
  return tutorDecimalText(text)
    .replace(/\bCORE clock\b/g,'실행 클록')
    .replace(/\bCORE(?=\s*(?:실행|상태|표시|코드|기록|완료)|가\s|의\s)/g,'시뮬레이터')
    .replace(/주소 ([\d,]+)에 ([^\n]+?)(?:을|를) 저장했습니다\./g,'메모리의 $1번 위치에 값 $2을 저장했습니다. 앞의 숫자는 저장할 위치이고, 뒤의 숫자는 그 위치에 넣은 데이터입니다.')
    .replace(/주소 ([\d,]+)의 읽기 결과는 ([^\n]+?)입니다\./g,'메모리의 $1번 위치에서 읽은 값은 $2입니다. 주소는 찾을 위치이고, 읽은 값은 그곳에 들어 있던 내용입니다.')
    .replace(/\b(x(?:[12]?\d|3[01])|a[0-7]|s(?:\d|1[01])|t[0-6]|sp|ra)에 ([^\n]+?)을 기록했습니다\./g,'$1 레지스터의 값을 $2으로 바꿨습니다.')
    .replace(/실제 계산은 ([^\n]+?)입니다\./g,'이번에 사용한 값으로 계산하면 $1입니다.')
    .replace(/ALU ([\w]+)의 실제 입력은 ([^\n]+?)이며 결과는 ([^\n]+?)입니다\./g,'계산 장치(ALU)가 $1 연산을 수행합니다. 입력값은 $2이고, 계산 결과는 $3입니다.')
    .replace(/원본 기계어 /g,'CPU가 읽는 명령어의 숫자 표현(기계어): ')
    .replace(/매핑 근거 /g,'C와 ASM의 연결을 확인한 방법: ')
    .replace(/ELF 디버그 정보 \(DWARF\)/g,'컴파일할 때 저장한 원본 코드의 줄 위치 정보')
    .replace(/(줄 위치 정보)\s*\(DWARF\)/g,'$1')
    .replace(/즉치값은 부호 확장됩니다\./g,'명령어에 적힌 숫자(즉치값)를 32비트로 늘릴 때, 양수·음수의 의미가 유지되도록 빈 비트를 채웁니다.')
    .replace(/(\d)(을|를|으로|로)(?=[\s.,])/g,(_,digit:string,particle:string)=>{
      const hasFinal='013678'.includes(digit);
      const ending=particle==='을'||particle==='를'?(hasFinal?'을':'를'):hasFinal&&!'178'.includes(digit)?'으로':'로';
      return digit+ending;
    });
}

/** Decimal display only: never use this text for PC lookup or execution. */
export function tutorDecimalText(text:string){
  return text.replace(/https?:\/\/[^\s<>]+|(?<!\w)(-?\d[\d,]*)\s*\(\s*(0x[\da-f]+)\s*\)|\b(0x[\da-f]+)\s*\(\s*(-?\d[\d,]*)\s*\)|-?\b0x[\da-f]+\b/gi,(match,decimal:string|undefined,hex:string|undefined,firstHex:string|undefined,lastDecimal:string|undefined)=>{
    if(/^https?:/i.test(match))return match;
    decimal??=lastDecimal;
    hex??=firstHex;
    if(decimal!==undefined&&hex!==undefined){
      const value=BigInt(decimal.replaceAll(',',''));
      const bits=(hex.length-2)*4;
      if(value===BigInt(hex)||BigInt.asUintN(bits,value)===BigInt(hex))return decimal;
      return `${decimal} (${BigInt(hex).toString(10)})`;
    }
    return match.startsWith('-')?(-BigInt(match.slice(1))).toString(10):BigInt(match).toString(10);
  });
}

export function explainStall(cycle:CycleHistoryItem|null,stage:string){
  const event=cycle?.cycle_events.stall;
  const reason=event?.stall_reason;
  const waiting=event?.assembly;
  const ex=cycle?.stage_activity?.EX??cycle?.buffers.EX;
  const prefix=stage==='IF'?'ID 단계의 명령어가 다음 단계로 갈 수 없어, 새 명령어를 받는 IF 단계도 함께 막힙니다. ':'';
  if(reason && ['load_use','load_use_hazard','data_hazard_load_use'].includes(reason))return {
    cause:prefix+`${ex?.assembly?`앞선 메모리 읽기 명령어 «${ex.assembly}»가 가져올 값`:'앞선 메모리 읽기 명령어가 가져올 값'}을 ${waiting?`«${waiting}» 명령어`:'뒤따르는 명령어'}가 입력으로 필요로 합니다. 아직 메모리 읽기가 끝나지 않아 계산에 사용할 새 값이 준비되지 않았습니다.`,
    solution:'새 명령어를 가져오는 IF와 해독하는 ID를 1클록 멈추고, PC(다음에 가져올 명령어의 주소)도 그대로 둡니다. 연산하는 EX에는 빈 작업인 버블을 넣습니다. 앞선 메모리 읽기가 끝나 값이 준비되면 대기하던 명령어가 진행합니다.',
  };
  if(reason==='strict_dependency')return {
    cause:prefix+'뒤따르는 명령어가 읽을 레지스터의 새 값을 앞선 명령어가 아직 기록하지 않았습니다. 포워딩을 사용하지 않는 설정이므로 레지스터에는 이전 값이 남아 있습니다.',
    solution:'대기 중인 명령어를 IF·ID에 그대로 두고, 연산하는 EX에는 빈 작업인 버블을 넣습니다. 앞선 명령어가 WB(결과 기록)에서 레지스터에 새 값을 넣은 뒤, 대기하던 명령어가 그 값을 읽고 진행합니다.',
  };
  return {cause:prefix+'뒤따르는 명령어에 필요한 입력값 또는 실행 자원이 아직 준비되지 않았습니다.',solution:'해당 명령어의 진행을 유지하고, 앞선 작업이 필요한 값이나 자원을 준비하면 실행을 이어갑니다.'};
}

// Hide data-availability notices; retain actual teaching and observed values.
export function tutorReadingText(text:string){
  text=tutorPlainText(text);
  text=text.replace(/\((?:old\((\w+)\)|(\w+))\s*\+\s*(-?\d+)\)\s*&\s*~1/gi,(_,old:string,reg:string,offset:string)=>`${old?`명령어 실행 전 ${old}`:reg} 값에 ${offset}바이트를 더한 뒤, 주소의 맨 오른쪽 비트를 0으로 만든 주소`)
    .replace(/u32\((\w+)\s*\+\s*(-?\d+)\)/gi,(_,reg:string,offset:string)=>`${reg}의 주소에 ${offset}바이트를 더해 32비트로 유지한 주소`)
    .replace(/s32\((\w+)\)/gi,'$1을 부호 있는 32비트 정수로 해석한 값')
    .replace(/u32\((\w+)\)/gi,'$1을 부호 없는 32비트 정수로 해석한 값');
  return text.split(/(?<=[.!?])\s+|\n/).filter(sentence=>!/(?:기록|정보|값|원인|경로|해설|시점).*(?:제공되지|미제공|기록에 없|기록이 없|확인되지|확인할 수 없)|기록만으로.*확인/.test(sentence)).join('\n').trim();
}

export function explainHazardReason(reason:string|null|undefined,fallback:string,assembly?:string|null){
  if(!reason)return fallback;
  if(reason==='control_hazard_branch_taken'&&/^jalr?\b/i.test(assembly?.trim()??''))return '점프 명령어가 다음 실행 주소를 바꿨습니다. 기존 순서대로 미리 가져온 명령어는 새 경로에 포함되지 않아 취소됩니다.';
  const explanations:Record<string,string>={
    control_hazard_branch_taken:'분기 조건이 참이 되어, 바로 다음 주소가 아닌 분기 목적지로 실행을 옮깁니다. 기존 순서대로 미리 가져온 명령어는 실행 경로에 맞지 않아 취소합니다.',
    control_hazard_jump:'점프 명령어가 실행 주소를 바꿉니다. 기존 경로에서 미리 가져온 명령어를 취소하고 점프 목적지에서 실행을 이어갑니다.',
    load_use_hazard:'앞선 메모리 읽기 명령어의 결과를 바로 다음 명령어가 필요로 합니다. 아직 읽기가 끝나지 않아 값을 사용할 수 없으므로 잠시 기다립니다.',
    data_hazard_load_use:'앞선 메모리 읽기의 결과를 뒤따르는 명령어가 사용합니다. 메모리에서 값이 준비될 때까지 해당 명령어를 대기시킵니다.',
    data_hazard:'앞선 명령어가 만들 새 값을 뒤따르는 명령어가 필요로 합니다. 새 값이 준비되기 전에 계산하면 이전 값을 사용하게 되므로 진행을 기다립니다.',
  };
  return explanations[reason]??(/^[a-z][a-z0-9_]*$/i.test(reason)?fallback:reason);
}

export function explainBubble(origin:CycleEvents|null|undefined){
  if(origin?.control_hazard.has_flush)return {
    cause:`${origin.control_hazard.assembly?`«${origin.control_hazard.assembly}» 명령어로 `:''}다음 실행 주소가 바뀌어, 기존 경로에서 미리 가져온 이 명령어가 실행 대상에서 제외되었습니다.`,
    solution:`기존 경로의 명령어를 취소하고 그 결과가 반영되지 않게 처리합니다. ${origin.control_hazard.redirect_pc?`${origin.control_hazard.redirect_pc} 주소에서`:'변경된 실행 주소에서'} 명령어를 다시 가져와 실행을 이어갑니다.`,
  };
  if(origin?.stall.has_stall)return {
    cause:`${origin.stall.assembly?`«${origin.stall.assembly}» 명령어에`:'뒤따르는 명령어에'} 필요한 입력값이 아직 준비되지 않아 EX로 진행할 수 없었습니다. 그 자리에 빈 작업을 넣으면서 버블이 발생했습니다.`,
    solution:'대기 중인 명령어는 IF·ID에 유지하고, 앞선 명령어는 계속 진행시켜 필요한 값을 준비합니다. 값이 준비되면 대기하던 명령어를 EX로 보내 실행합니다.',
  };
  return {cause:null,solution:null};
}

export function isForwardingTarget(event:CycleEvents['forwarding']|undefined,stage:string,assembly:string|null|undefined){
  return Boolean(event?.has_forwarded && stage===(event.stage??'EX') && assembly && event.assembly?.replace(/\s/g,'')===assembly.replace(/\s/g,''));
}

export function explainForwarding(info:CycleEvents['forwarding']['forwarding_info']|null){
  if(!info)return '앞선 명령어가 계산한 값을 필요한 입력으로 직접 전달합니다. 레지스터에 저장한 뒤 다시 읽을 때까지 기다리지 않습니다.';
  const transfers=info.forwarded_to.map((target,index)=>{
    const origin=info.forwarded_from[index];
    const from=origin==='EX/MEM'?'앞선 명령어가 연산을 마치고 보관한 결과(EX/MEM)':origin==='MEM/WB'?'앞선 명령어가 레지스터에 기록하려고 준비한 결과(MEM/WB)':'앞선 명령어가 준비한 결과';
    const to=target==='rs1'?'첫 번째 입력':target==='rs2'?'두 번째 입력':'필요한 입력';
    const register=info.target_register[index];
    return `${register?`${tutorRegisterName(register)}의 새 값이 필요한 ${to}`:to}으로 ${from}를 직접 전달합니다.`;
  });
  return `${transfers.length?transfers.join('\n'):'앞선 명령어의 결과를 현재 명령어의 입력으로 직접 전달합니다.'}\n레지스터에 저장한 뒤 다시 읽을 때까지 기다리지 않고 새 값으로 계산합니다. 포워딩은 이 값의 전달을 해결하며, 다른 이유로 대기가 필요한지는 별도로 판단합니다.`;
}
