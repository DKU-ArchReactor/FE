import type {CycleEvents} from '@/type/simulation';

// Hide data-availability notices; retain actual teaching and observed values.
export function tutorReadingText(text:string){
  return text.split(/(?<=[.!?])\s+|\n/).filter(sentence=>!/(?:기록|정보|값|원인|경로|해설|시점).*(?:제공되지|미제공|기록에 없|기록이 없|확인되지|확인할 수 없)|기록만으로.*확인/.test(sentence)).join('\n').trim();
}

export function explainHazardReason(reason:string|null|undefined,fallback:string){
  if(!reason)return fallback;
  const explanations:Record<string,string>={
    control_hazard_branch_taken:'분기 조건이 참이 되어, 바로 다음 주소가 아닌 분기 목적지로 실행을 옮깁니다. 기존 순서대로 미리 가져온 명령어는 실행 경로에 맞지 않아 취소합니다.',
    control_hazard_jump:'점프 명령어가 실행 주소를 바꿉니다. 기존 경로에서 미리 가져온 명령어를 취소하고 점프 목적지에서 실행을 이어갑니다.',
    load_use_hazard:'앞선 메모리 읽기 명령어의 결과를 바로 다음 명령어가 필요로 합니다. 아직 읽기가 끝나지 않아 값을 사용할 수 없으므로 잠시 기다립니다.',
    data_hazard_load_use:'앞선 메모리 읽기의 결과를 뒤따르는 명령어가 사용합니다. 메모리에서 값이 준비될 때까지 해당 명령어를 대기시킵니다.',
    data_hazard:'앞선 명령어가 만들 새 값을 뒤따르는 명령어가 필요로 합니다. 새 값이 준비되기 전에 계산하면 이전 값을 사용하게 되므로 진행을 기다립니다.',
  };
  return explanations[reason]??(/^[a-z][a-z0-9_]*$/i.test(reason)?fallback:reason);
}

export function explainForwarding(info:CycleEvents['forwarding']['forwarding_info']|null){
  if(!info)return '앞선 명령어가 계산한 값을 필요한 입력으로 직접 전달합니다. 레지스터에 저장한 뒤 다시 읽을 때까지 기다리지 않습니다.';
  const from=info.forwarded_from.map(value=>value==='EX/MEM'?'앞선 명령어가 연산을 마치고 결과를 보관하는 곳(EX/MEM)':value==='MEM/WB'?'메모리 접근을 마치고 레지스터에 기록할 결과를 보관하는 곳(MEM/WB)':`${value} 경로`);
  const to=info.forwarded_to.map(value=>value==='rs1'?'현재 명령어의 첫 번째 입력값(rs1)':value==='rs2'?'현재 명령어의 두 번째 입력값(rs2)':`${value} 입력`);
  return `${from.length?from.join(', '):'앞선 명령어의 결과'}에서 값을 가져와 ${to.length?to.join(', '):'현재 명령어의 입력'}으로 바로 사용합니다.${info.target_register.length?` 여기서 필요한 값은 ${info.target_register.join(', ')} 레지스터의 새 값입니다.`:''} 레지스터에 저장한 뒤 다시 읽을 때까지 기다리지 않으므로, 이 값 전달 때문에 멈출 필요가 없습니다.`;
}
