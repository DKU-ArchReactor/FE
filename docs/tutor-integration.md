# 백엔드 규칙 기반 튜터 연동

백엔드 튜터 API를 먼저 배포한 뒤 이 프런트 변경을 배포한다.

- 컴파일 응답의 `tutor.c_lines`와 `tutor.asm_instructions`를 캐시한다. C 컴파일에 ASM 출력이 없으면 시뮬레이션의 코드 매핑에서 명령어 해설을 받는다.
- 시뮬레이션 응답 바깥의 `tutor`를 보존하고, `cycle_explanations`에서 현재 클록의 스톨·포워딩·플러시를 모두 표시한다.
- 선택한 C 줄 및 명령어의 해설이 캐시에 없으면 `POST /api/v1/tutor/explain`으로 최대 128개씩 요청한다. 선택 변경 시 진행 중 요청을 취소하며 실패 시 재시도 버튼을 표시한다.
- `tutorAnalysis.ts`는 서버 해설의 캐시와 화면 표시 변환만 담당한다. 해설 규칙은 FastAPI가 소유한다.
- 기존 응답에 `tutor`가 없다면 명령어 해설은 추가 API로 조회한다. 사이클 해설은 새 백엔드에서 다시 실행한 결과가 필요하다.

AI 채팅, Bedrock 연결, 전체 실행 맥락 분석은 이 변경에 포함하지 않는다.

검증: `node --test tests/tutor.test.mjs`, `npm run build`, 변경 파일 ESLint.
