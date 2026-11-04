# 테스트 전략과 검증 결과

기록일 2026-10-31 (Asia/Seoul). **Phase 0 전체 완료 또는 실통화 성공으로 해석하지 않는다.**

## 이번 실행 결과

환경: macOS, Node v24.11.0, npm 11.6.1, Docker CLI 29.1.2, Compose v2.40.3. 외부 서비스 credential을 설정하거나 사용량을 발생시키지 않았다.

| 검사 | 실제 결과 | 의미 |
|---|---|---|
| `npm test` | **9/9 통과** | Node 내장 TS 실행, 접근 제한·역할·방 검증·Zoom HMAC/TTL·녹화 상태 계약·비용 사용량 계산 |
| `node --check` API/core/tests/RTC `.ts` | 통과 | 타입 제거 가능한 TS 문법 확인. 타입 검사나 SDK 호환성 검증이 아님; TSX 제외 |
| package/tsconfig JSON 파싱 | 통과 | JSON 구문 확인 |
| 문서 상대 링크 / CSV 열 수 | 최종 확인 통과 | 문서 탐색과 결과 템플릿 구조 확인 |
| `docker compose --profile app config --quiet` | **통과** (`.env.example`를 `.env`로 복사 후) | Compose 구조/변수 해석만 확인; 컨테이너 실행 아님 |
| `npm install --cache .npm-cache --fetch-retries=0 --fetch-timeout=10000` | **실패: ENOTFOUND registry.npmjs.org** | DNS/네트워크 제한으로 의존성 설치 및 lockfile 생성 불가 |
| `npm run typecheck` | **실행 불가: tsc not found** | TypeScript 컴파일러 미설치; 타입 안전성 검증 미완료 |
| `npm run lint` | **실행 불가: eslint not found** | 린트 미완료 |
| `npm run build` | **실행 불가: tsc / next not found** | API 빌드 검사·Next 프로덕션 빌드 미완료 |
| `npm run test:api` | **실패: ERR_MODULE_NOT_FOUND express** | HTTP 통합 테스트 본문 시작 전 dependency 로드 실패; 통과한 테스트로 집계하지 않음 |
| `docker info` | **실행 불가: docker.sock permission denied** | 데몬 접근 제한. DB 시작·이미지 빌드·컨테이너 통합 실행 미검증 |
| 실제 브라우저 UI / SDK 통화 | **미실행** | 웹 의존성·시험 계정·승인된 사용량 필요 |
| 녹화/웹훅/스토리지/재생 E2E | **미구현·미실행** | 실제 서비스 핵심 게이트로 남음 |

초기 Compose 검사는 `.env` 부재로 실패했다. 예제 설정 복사 후 같은 검사는 통과했다. npm 오류는 curl의 레지스트리 호스트 조회 실패로도 확인했다. 캐시에 RTC SDK/TypeScript 실행 도구가 없어 오프라인 설치로 전체 검증을 대체하지 않았다. 의존성 실패를 코드 오류 해결이나 테스트 통과로 보고하지 않는다.

## 자동화 검사 범위

`tests/core.test.ts`:

- 외부 연결 기본 차단, 없는/잘못된/약한/중복 운영자 키 거부.
- 서버 역할 결정 및 참가 UUID 분리.
- 허용되지 않은 방/공급자/추가 role 필드/빈 이름 거부.
- Zoom topic/role/identity/iat/exp/version 서명 및 키 누락 거부.
- 요청 성공만으로 녹화 READY 처리 불가, 검증된 객체가 있어야 READY 가능.
- 중복 상태 멱등, 완료 상태 역행 방지, FAILED 재시도 이력 유지.
- 계획서 사용량 8,880 참가자 분 / 2,280 녹화 분 계산.

`tests/integration/api.test.ts`는 dependency 설치 후 HTTP health, 접근·Origin·방·역할 검사, student JWT/no-store, provider 미설정, body limit, rate limit을 확인한다. 외부 RTC 연결은 하지 않는다. 현재 이 suite는 실행되지 못했다.

CI 정의는 unit → HTTP integration → typecheck → lint → build → Compose config 순서다. 워크플로 파일만 작성했고 Git 저장소/원격 push/실제 CI 실행은 없다. API는 Node가 TS를 직접 실행하므로 `build`는 tsc 검사이며 별도 JS 번들을 만들지 않는다.

## 다음 검증 절차

네트워크와 Docker 권한이 제공된 일반 개발 환경에서:

```sh
npm install
npm run check
docker compose --profile app config --quiet
docker compose --profile app up --build
```

최초 install 후 lockfile을 검토/관리하고 CI·Docker에서 `npm ci`만 사용하도록 고정한다. 설치된 SDK의 타입 선언과 현재 공식 예제를 대조하여 차이를 수정한다. 특히 Zoom Stream reference 페이지는 구버전 표기를 포함하므로 attach/render/share API를 반드시 확인한다.

웹 smoke: 공급자 선택·disabled 입장, 잘못된 키 오류, 비밀키가 HTML/로그/JSON export에 없는지 확인. 실제 미디어 시험은 승인된 계정으로 마이크/카메라·오디오 재생 허용·공유·음성 우선·퇴장 장치 해제·연결 복구를 양쪽에서 검증한다. 브라우저 자동 재생 정책 때문에 입장 성공과 오디오 실제 재생을 별도로 확인한다.

교차 브라우저/저사양/네트워크 시험은 [RTC 시험표](rtc-poc.md), 녹화·파일·재생/권한은 [녹화 설계](recording.md)를 따른다. 손실·음성 품질·CPU/RAM 결과를 연결 이벤트만 보고 추정하지 않는다.

## 변경 파일 묶음

- 문서: README 및 docs의 아키텍처/로드맵/API/녹화/환경/RTC/근거/검증 자료.
- 앱: apps/web Next UI와 공급자 어댑터, apps/api Express 토큰 경계.
- 공통/검사: packages/core, tests 단위·HTTP 통합 테스트.
- 환경: package manifests, TS/ESLint/PostCSS 설정, .env.example, compose.yaml, infra, .github/workflows.
- 원본 `Lesora_plan.md` 수정 없음. commit/push/PR 생성 없음.

## 2026-11-02 기능 브랜치 최초 업로드 검증

Git 자동 commit/push 정책을 AGENTS.md에 기록하고 초기 구현을 `feat/phase0-bootstrap`에 보관한다. 이번 변경에서 `npm test` 9/9 및 Compose 구성 검사를 다시 통과했다. 스테이징 파일의 비밀정보 패턴·환경파일 제외·문서 링크·diff 공백 검사를 수행한다. 전체 의존성 설치/타입 검사/린트/빌드 및 실통화 검증은 이번 Git 정책 작업에서 재실행하지 않았으며, 앞서 기록한 미완료 상태를 유지한다. 기능 브랜치 업로드는 Phase 0 완료나 운영 배포 승인을 의미하지 않는다.

최초 스테이징 검사에서 원본 계획서의 Markdown 줄바꿈용 후행 공백은 원본 보존을 위해 유지했다. 작성 코드의 후행 공백과 CSV 줄끝은 정리했고, 원본 계획서를 제외한 `git diff --cached --check`를 통과했다.
