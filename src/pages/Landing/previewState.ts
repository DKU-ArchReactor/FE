export function getPreviewState(mode: "single" | "pipeline", clock: number) {
  const maxClock = mode === "single" ? 4 : 8;
  const completed = mode === "single" ? clock : Math.max(0, clock - 4);
  const stored = mode === "single" ? clock >= 4 : clock >= 7;
  const explanations =
    mode === "single"
      ? [
          "재생 버튼을 눌러 보세요. 5와 3이 레지스터를 거쳐 메모리에 저장되는 과정을 볼 수 있어요.",
          "첫 명령어 완료. t0 레지스터에 5가 저장됐어요.",
          "두 번째 명령어 완료. t1 레지스터에 3이 저장됐어요.",
          "5 + 3 = 8. 두 레지스터의 값을 더해 t2에 기록했어요.",
          "t2의 값 8을 메모리에 저장했어요. 네 명령어의 처리가 끝났어요.",
        ]
      : [
          "파이프라인은 서로 다른 명령어를 여러 단계에서 겹쳐 처리해요. 재생 버튼을 눌러 보세요.",
          "첫 명령어를 가져왔어요(IF). 아직 레지스터에 결과를 쓰는 단계는 아니에요.",
          "첫 명령어를 해석하면서(ID), 다음 명령어를 가져와요(IF).",
          "첫 명령어는 연산 단계(EX)에 있어요. 뒤의 명령어도 각자의 단계로 이동해요.",
          "여러 명령어가 동시에 진행 중이에요. 아직 WB에 도착한 명령어는 없어요.",
          "첫 명령어가 WB에 도착했어요. 이제 t0에 5가 기록돼요.",
          "두 번째 명령어가 완료되어 t1이 3이 됐어요. 뒤에서는 덧셈과 저장이 진행돼요.",
          "덧셈 결과 8이 t2에 기록되고, Store의 MEM 단계에서 메모리에도 8이 저장돼요.",
          "마지막 명령어까지 처리가 끝났어요. 계산 결과는 싱글 사이클과 같아요.",
        ];
  return {
    maxClock,
    completed,
    stored,
    values: [
      completed >= 1 ? 5 : 0,
      completed >= 2 ? 3 : 0,
      completed >= 3 ? 8 : 0,
    ],
    explanation: explanations[clock],
  };
}
