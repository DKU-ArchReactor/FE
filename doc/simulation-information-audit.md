# 시뮬레이션 정보 정합성 점검

기준일: 2026-11-05. CORE·BE·FE의 실행 결과와 교육 화면이 같은 사실을
표현하는지 코드 및 로컬 실행으로 점검했다. 아래의 미검증 범위까지
정상이라고 판단한 보고서는 아니다.

## 작업 기준과 위치

| 저장소 | 기준 커밋/브랜치 | 로컬 작업 |
|---|---|---|
| CORE | `main` `1bf2957` | `CORE`, `fix/separate-single-cycle-engine` |
| FE | `feat/sliding-window` `c6c9edb` | `FE`, `fix/simulation-information` |
| BE | `core` `1382032` | `BE-audit`, `fix/simulation-information` |

각 저장소의 원격 정보를 갱신한 뒤 작업했다. 원래 `BE`의 `main` 작업 폴더는
유지하고 최신 `core`에서 별도 worktree를 만들었다. 변경 사항은 위 작업
브랜치에서 관리한다. `main`/`core` 병합과 서버 배포는 수행하지 않았다.

## 발견 및 수정한 정보 오류

| 항목 | 기존 문제 | 현재 처리 |
|---|---|---|
| 싱글 엔진 | 직렬화한 파이프라인을 싱글로 사용 | 독립 실행 흐름, 한 명령어를 한 클록에 완료 |
| WB 시점 | WB 버퍼 진입을 기록 완료로 해석 | 현재 클록은 `stage_activity`, 다음 클록 버퍼는 `buffers` |
| 화면별 모드 | pipeline 결과 하나로 싱글/파이프라인 표시 | 같은 빌드를 두 모드로 요청하고 결과를 따로 보관 |
| 싱글 스텝 수 | 정적인 어셈블리 줄 수를 실행 횟수로 사용 | 동적인 `history` 순서 사용. 반복·분기·함수 호출을 그대로 보존 |
| 실행 전 상태 | 첫 명령 완료 후 상태를 Step 0에도 표시 | CORE가 보관한 `initial_state` 사용. 없으면 미확인 |
| C 실행 위치 | 특정 예제에 고정된 PC→C 줄 표와 문자열 추정 | 고정 표와 추정 실행 강조 제거. 정적 C/ASM 번역 탐색과 실제 PC를 구분 |
| 코드 주소/기계어 | main을 `0x10018`로 가정하고 줄마다 +4, raw=0으로 표시 | CORE의 실제 명령어 주소·raw word 사용 |
| 런타임 크기 | `_start` 영역을 항상 24바이트로 표시 | 고정 주소/크기 블록 제거 |
| BSS 구분 | 값이 0이면 BSS로 이동 | ELF 섹션 범위로 구분. 값이 바뀌어도 영역 이름 유지 |
| Heap/Stack/NULL | 임의 주소 경계를 실제 영역처럼 표시, 저주소 접근 금지라고 설명 | ELF 메타데이터가 없는 주소는 영역 미확인. 구현하지 않은 보호/할당 기능을 주장하지 않음 |
| 메모리 이동 | 현재 레지스터로 과거 MEM 주소/값을 재계산 | `stage_activity.MEM`의 실제 target/read/write 데이터 표시 |
| 값 없음 | 응답에 없는 레지스터도 0으로 표시 | `—` 표시 |
| 레지스터 강조 | 직전 렌더/이동 상태와 비교 | 선택한 인접 실행 클록의 실제 스냅샷 비교 |
| 파이프라인 클록 | 시작 시 빈 준비 클록 1개 포함 | 첫 클록에 IF 실행, 독립 N개 명령은 N+4클록 |
| WB 의존성 | ID가 이미 기록된 WB 값을 기다리며 정지 | WB 기록 후 같은 클록 ID에서 읽기 가능 |
| 잘못된 해저드 | 즉시값의 비트를 rs2 읽기로 해석 | 사용하지 않는 소스 필드를 제거 |
| 분기/정지 우선순위 | 잘못된 경로의 stall이 flush를 막음 | taken redirect 우선, 폐기 단계에 flushed 표시 |
| 종료 후 실행 | 종료 ecall 뒤의 store가 메모리에 반영 | WB 종료 시 더 어린 작업 중단 |
| 상위 메모리 주소 | signed ALU 결과를 주소 키로 사용 | 유효 주소를 32비트 unsigned로 정규화 |
| 잘못된 명령 주소 | 정렬되지 않은 점프를 정상 종료로 해석 | `INSTRUCTION_ALIGNMENT_ERROR` 기록 |
| 로드 데이터 수 | 실행 중 추가한 메모리까지 loaded data count에 포함 | 초기 로드된 단어 수 유지 |
| 실패한 명령 수 | 오류 ecall도 완료 명령으로 집계 | 오류 명령은 retire하지 않음 |
| 이전 결과 재사용 | 소스 수정 후 이전 실행이 남음 | 편집·재컴파일 시 초기화, 늦게 도착한 번역 결과는 소스 revision 확인 |
| 서로 다른 프로그램 비교 | 파일 가져오기로 다른 빌드의 두 모드가 섞일 가능성 | 입력 SHA-256 fingerprint가 같은 결과만 함께 유지 |
| BE 응답 | 요청 모드/응답 모드 및 종료 상태 불일치를 전달 | 모드·종료 상태 충돌을 HTTP 502로 거부 |
| FE 응답 | 형식·클록·누적 통계 충돌을 그대로 표시 | 형식, 모드, history 길이, 최종 누적 통계 검증 |
| 설명/문서 | C 지원이 예정이라고 표시, lw/sw를 항상 스택이라고 설명, 빈/오류 단계를 정상 실행처럼 설명 | 구현 상태와 실제 기록에 맞게 수정 |

메모리 뷰는 확인 가능한 주소/값/ELF 영역 목록으로 정리했다. 이전의
고정 6영역 그림과 주소 추정은 제거했다. Source/Translation의 수동 탐색은
유지하지만 링크된 ELF의 실제 debug-line 매핑이 없는 경우 자동 C 실행 줄을
만들어내지 않는다. 현재 튜터는 규칙 기반 설명이며 생성형 AI 연동은 예정이다.

## 검증 결과

| 검증 | 결과 | 범위 |
|---|---|---|
| CORE pytest | 187 passed | 명령어 연산, 메모리, 분기/반복, 종료/오류, 이력, WB/상태 일치, 초기 상태/메타데이터 |
| ELF validator | validation_ok | 저장소의 `tests/program2.elf` |
| FE 테스트 | 14 passed | 스텝/초기 상태/계약/영역 구분 및 실제 CORE 결과의 컴포넌트 HTML 렌더링 |
| FE production build | 성공 | TypeScript 및 Vite |
| FE lint | 오류 0, 경고 4 | 기존 파일 로드 관련 Hook dependency 경고가 남아 있음 |
| BE pytest | 43 passed, 5 skipped | 스키마, 토큰/소유권, CORS, gRPC 오류 변환, 모드/상태 검증, 실제 CORE JSON 보존 |
| Git diff whitespace | 통과 | 세 작업 폴더 |

BE의 실제 결과 보존 테스트는 수정한 CORE가 생성한 JSON을 로컬 fixture
gRPC 서버가 반환하고 기존 BE 클라이언트가 이를 그대로 받는지 검증한다.
운영 CORE 서비스나 운영 S3/DB를 통과한 테스트는 아니다.

`tests/program.elf`와 `tests/program2.elf`는 싱글, 포워딩 켠 파이프라인,
포워딩 끈 파이프라인에서 최종 레지스터·메모리·출력·retire 수가 일치한다.
각 클록의 WB 쓰기 값이 같은 클록의 레지스터 스냅샷에 들어가는지도 검사한다.

최신 `program2.elf` 기준: 97개 명령, 싱글 97클록, 기본 파이프라인 134클록,
stall 9회, forwarded operand 44개. 두 모드 모두 `ALL PASS`를 출력한다.
이전 보고의 135클록에서 준비용 빈 클록 1개를 제거한 결과다.

## 로컬 재현

PowerShell에서 workspace 루트를 기준으로 실행한다. Python 환경 경로는
이 작업 공간의 검증 환경이며 다른 환경에서는 각 저장소 의존성을 설치한다.

```powershell
Set-Location CORE
..\.venv-analysis\Scripts\python.exe -m pytest -q
..\.venv-analysis\Scripts\python.exe tests/tester.py --input tests/program2.elf --mode single --output-dir ../analysis-results/engine-verification/single
..\.venv-analysis\Scripts\python.exe tests/tester.py --input tests/program2.elf --mode pipeline --output-dir ../analysis-results/engine-verification/pipeline
Set-Location ../FE
$env:CORE_FIXTURE_DIR = (Resolve-Path ../analysis-results/engine-verification).Path
npm test
npm run build
npm run lint
Set-Location ../BE-audit
$env:DEBUG = 'false'
..\.venv-audit\Scripts\python.exe -m pytest -q -rs
```

`DEBUG=false`는 이 실행 호스트에 설정된 문자열 `DEBUG=release`가 bool 설정과
충돌하는 것을 피하기 위한 테스트 프로세스 설정이다. 운영 설정을 변경하지 않았다.

## 화면에서 수정한 CORE 확인하기

1. `http://localhost:5173`을 연다. 기존 Vite 프로세스가 최신 FE 작업 파일을 사용한다.
2. 상단의 **로컬 CORE 실행 결과(JSON) 열기**로
   `analysis-results/engine-verification/single/simulation_result.json`을 선택한다.
3. Step 0의 초기 상태와 Step 1 이후 명령별 레지스터·메모리 변화를 확인한다.
4. pipeline 폴더의 JSON도 연다. 해당 모드로 이동하며 134클록을 탐색할 수 있다.
   두 파일의 fingerprint가 같으면 두 모드 결과가 함께 유지된다.

이 파일 선택은 브라우저 내부에서 JSON을 읽는 기능이다. 서버 업로드나 새 백엔드
API를 사용하지 않는다. 일반 컴파일 버튼은 기존 서버 API를 사용한다. 서버의
싱글 결과가 예전 모델이면 오류 안내를 표시하고 가짜 싱글 결과로 변환하지 않는다.

## 남은 확인 항목

- 실제 브라우저 시각/조작 검증: 도구가 Windows 브라우저의 현재 URL을 안전하게
  확인하지 못해 조작이 중단됐다. HTML 렌더링 테스트 통과를 시각 검증으로 간주하지 않는다.
- BE에서 native GCC 성공/오류 컴파일 2개, RV32IM cross compiler 1개 테스트는
  해당 실행 파일이 없어 skip했다. 예전 오류 컴파일 테스트가 `WinError` 문자열만
  보고 통과하지 않도록 GCC 없음을 명시적으로 표시했다.
- PostgreSQL migration 테스트 2개는 `TEST_DATABASE_URL`이 없어 skip했다.
- FE 파일 로드 Hook dependency 경고 4개는 별도 후속 점검 항목이다.
- 실제 운영 API→운영 CORE, 새 CORE의 gRPC 서버 어댑터, 배포·롤백은 검증/수행하지 않았다.
  BE `docs/aws/core-grpc.md`가 참조하는 `dist/CORE`와 `Dockerfile.server`는
  현재 작업 공간/공개 CORE 체크아웃에 없다. 문서의 과거 배포 성공 기록만으로
  현재 수정한 CORE가 서버에서 사용된다고 판단할 수 없다.
- 링크된 ELF의 PC→C 소스 줄 매핑은 후속 연동 항목이다. 현재 C↔ASM 정보는
  정적 번역 관계이며 동적 실행 위치의 근거로 사용하지 않는다.
- 런타임 오류는 즉시 중단한다. EX 오류 후 older pipeline을 drain하는 precise
  exception 모델은 구현하지 않는다. 정상 프로그램의 두 모드 결과 일치와 구분한다.
- 미구현 BE objdump/log 조회 API는 HTTP 501, AI/Queues/IO 패널은 예정/자리 표시 기능이다.

전체 파일에서 모든 가능한 오류가 없음을 증명한 것은 아니다. 위 범위의
정보 흐름과 재현 사례를 검증했고, 외부 의존성·배포·시각 검증의 한계를 명시했다.
