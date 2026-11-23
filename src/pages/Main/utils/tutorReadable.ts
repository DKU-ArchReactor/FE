import type {CycleEvents,CycleHistoryItem} from '@/type/simulation';

export function explainStall(cycle:CycleHistoryItem|null,stage:string){
  const event=cycle?.cycle_events.stall;
  const reason=event?.stall_reason;
  const waiting=event?.assembly;
  const ex=cycle?.stage_activity?.EX??cycle?.buffers.EX;
  const prefix=stage==='IF'?'ID 단계의 명령어가 다음 단계로 갈 수 없어, 새 명령어를 받는 IF 단계도 함께 막힙니다. ':'';
  if(reason==='load_use')return {
    cause:prefix+`${ex?.assembly?`앞선 메모리 읽기 명령어 «${ex.assembly}»가 가져올 값`:'앞선 메모리 읽기 명령어가 가져올 값'}을 ${waiting?`«${waiting}» 명령어`:'뒤따르는 명령어'}가 입력으로 필요로 합니다. 아직 메모리 읽기가 끝나지 않아 계산에 사용할 새 값이 준비되지 않았습니다.`,
    solution:'PC와 IF·ID의 진행을 1클록 유지하고 EX에는 버블을 넣습니다. 앞선 메모리 읽기는 계속 진행하며, 값이 준비되면 대기하던 명령어가 실행을 이어갑니다.',
  };
  if(reason==='strict_dependency')return {
    cause:prefix+'뒤따르는 명령어가 읽을 레지스터의 새 값을 앞선 명령어가 아직 기록하지 않았습니다. 포워딩을 사용하지 않는 설정이므로 레지스터에는 이전 값이 남아 있습니다.',
    solution:'PC와 IF·ID를 유지하고 EX에 버블을 넣습니다. 앞선 명령어가 WB에서 새 값을 기록한 뒤, 대기하던 명령어가 그 값을 읽고 진행합니다.',
  };
  return {cause:prefix+'뒤따르는 명령어에 필요한 입력값 또는 실행 자원이 아직 준비되지 않았습니다.',solution:'해당 명령어의 진행을 유지하고, 앞선 작업이 필요한 값이나 자원을 준비하면 실행을 이어갑니다.'};
}

// Hide data-availability notices; retain actual teaching and observed values.
export function tutorReadingText(text:string){
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

export function explainForwarding(info:CycleEvents['forwarding']['forwarding_info']|null){
  if(!info)return '앞선 명령어가 계산한 값을 필요한 입력으로 직접 전달합니다. 레지스터에 저장한 뒤 다시 읽을 때까지 기다리지 않습니다.';
  const from=info.forwarded_from.map(value=>value==='EX/MEM'?'앞선 명령어가 연산을 마치고 결과를 보관하는 곳(EX/MEM)':value==='MEM/WB'?'메모리 접근을 마치고 레지스터에 기록할 결과를 보관하는 곳(MEM/WB)':`${value} 경로`);
  const to=info.forwarded_to.map(value=>value==='rs1'?'현재 명령어의 첫 번째 입력값(rs1)':value==='rs2'?'현재 명령어의 두 번째 입력값(rs2)':`${value} 입력`);
  return `${from.length?from.join(', '):'앞선 명령어의 결과'}에서 값을 가져와 ${to.length?to.join(', '):'현재 명령어의 입력'}으로 바로 사용합니다.${info.target_register.length?` 여기서 필요한 값은 ${info.target_register.join(', ')} 레지스터의 새 값입니다.`:''} 레지스터에 저장한 뒤 다시 읽을 때까지 기다리지 않으므로, 이 값 전달 때문에 멈출 필요가 없습니다.`;
}
