# 레소라 (Lesora)

브라우저 기반 범용 온라인 교육 플랫폼. 요구사항 기준은 [Lesora_plan.md](Lesora_plan.md)이며 원본을 유지한다.

## GitHub 저장소

- 공개 저장소: [won-seokey/Lesora](https://github.com/won-seokey/Lesora)
- 원격 이름: `origin`
- 원격 URL: `https://github.com/won-seokey/Lesora.git`
- 로컬 초기 브랜치: `main`

2026-11-02 로컬 Git 초기화와 `origin` 등록을 완료했다. `won-seokey` 계정의 GitHub 인증 및 저장소 ADMIN 권한, 원격 조회 성공을 확인했다. 초기 구현 브랜치는 `feat/phase0-bootstrap`이다. 앞으로 작업과 검증 후 기능별 브랜치에 자동 commit/push하며, `main` 병합·force push·브랜치 삭제는 별도 승인을 받는다. [프로젝트 작업 지침](AGENTS.md)에 이 정책을 기록했다. [연결 및 업로드 절차](docs/development.md#github-저장소-연결과-업로드)를 따른다.

현재는 **Phase 0 RTC 비교 PoC 착수 상태**다. Next.js/Express 구조, 서버 토큰 발급, Zoom/LiveKit 브라우저 어댑터와 검증 화면을 작성했다. 최종 RTC는 미선정이다. 실제 사용자 인증·DB 저장·채팅·자동 녹화·다시보기는 아직 구현되지 않았다.

## 빠른 시작

Node.js 24.11.0과 npm, 의존성을 받을 수 있는 네트워크가 필요하다.

```sh
cp .env.example .env
npm install
npm test
npm run dev:api
```

다른 터미널에서:

```sh
npm run dev:web
```

`http://localhost:3000`에서 확인한다. 기본 `POC_ENABLED=false`이므로 외부 RTC 연결은 거부된다. 실제 서비스 사용량 승인을 받은 뒤 [환경 설정](docs/development.md)에 따라 키를 준비한다. SDK 키를 프론트엔드 환경변수에 넣지 않는다.

현재 작업 환경에서는 npm 레지스트리 DNS 접근 제한으로 의존성 설치가 실패했다. 따라서 웹/API 실행·전체 빌드·SDK 동작을 확인한 상태가 아니다. lockfile은 네트워크 가능한 환경에서 처음 설치한 뒤 생성·검토해야 한다. [검증 결과](docs/testing.md)에 실행 가능/불가능 항목을 구분했다.

## 개발 명령

| 명령 | 용도 |
|---|---|
| `npm test` | 의존성 없이 Node 내장 단위 테스트 |
| `npm run test:api` | Express 설치 후 HTTP 경계 통합 테스트; 실제 외부 통화 없음 |
| `npm run typecheck` | 모든 TS workspace 타입 검사 |
| `npm run lint` | ESLint |
| `npm run build` | API 타입 검사 + Next 프로덕션 빌드 |
| `npm run check` | 위 검증 순차 실행 |
| `docker compose up -d db` | 로컬 PostgreSQL만 실행 |
| `docker compose --profile app up --build` | web/api/db 로컬 컨테이너 |

## 문서

- [아키텍처·기술 선택·현재 범위](docs/architecture.md)
- [Phase 0~4 로드맵과 완료 조건](docs/roadmap.md)
- [데이터 모델·권한·API](docs/data-api.md)
- [로컬 환경·외부 SDK 설정](docs/development.md)
- [RTC 비교 매트릭스·비용·선정 기준](docs/rtc-poc.md)
- [자동 녹화·저장·재시도 설계](docs/recording.md)
- [테스트 전략·현재 검증 결과](docs/testing.md)
- [공식 문서와 검토 근거](docs/sources.md)

다음 작업은 의존성 설치/빌드 검증 → 양 SDK 기본 통화 → 자동 녹화 E2E 구현/검증 → 저사양·불량망 비교다. 실제 수업 또는 상용 출시 준비 완료 상태로 사용하지 않는다.
