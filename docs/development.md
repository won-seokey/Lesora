# 로컬 실행과 외부 SDK 설정

## GitHub 저장소 연결과 업로드

프로젝트 공개 저장소는 [won-seokey/Lesora](https://github.com/won-seokey/Lesora)이며 HTTPS 원격 주소는 `https://github.com/won-seokey/Lesora.git`다. 앞으로 이 저장소를 `origin`으로 사용한다.

**연결 상태 (2026-11-02):** `origin` 연결, `won-seokey` 인증, 기능 브랜치 최초 push를 확인했다. 기본 브랜치는 `main`이며 PR과 필수 CI `check`, 최신 main 반영, 리뷰 대화 해결을 요구하는 보호 규칙을 적용했다. 초기 구현은 `feat/phase0-bootstrap` PR에서 검토한다.

이후 개발 환경은 다음과 같이 시작한다. 현재 작업 폴더는 이미 연결되어 있으므로 clone을 다시 실행하지 않는다.

```sh
# 새 PC에서 최초 설정할 때만
git clone https://github.com/won-seokey/Lesora.git
cd Lesora
# 새 작업을 시작할 때: 작업 트리가 깨끗한지 먼저 확인
git status --short
git fetch origin
git switch -c feat/<작업명> origin/main
```

작업·검증 후 비밀정보를 제외하고 자동 commit/push하며 `main` 대상 PR을 생성한다. 스테이징 파일과 diff를 확인하고 `.env` 등 인증정보가 포함되지 않게 한다.

```sh
git check-ignore .env
git diff --cached --check
git diff --cached
git commit -m "Describe the completed change"
git push -u origin HEAD
gh pr create --base main --draft --title "Change title" --body-file /path/to/pr-body.md
```

실제 명령의 브랜치 이름·변경 파일·본문은 작업에 맞춰 지정한다. 리뷰와 CI를 통과하고 사용자가 승인하면 squash merge한다. `main` 병합·force push·브랜치 삭제는 별도 승인 대상이며 자동 브랜치 삭제는 꺼져 있다. 자세한 흐름과 CI/CD 확장 계획은 [브랜치 전략](branching.md), 에이전트 작업 권한은 [AGENTS.md](../AGENTS.md)를 따른다.

Git 인증은 로컬 keyring/GitHub CLI를 사용하고 토큰을 문서나 원격 URL에 넣지 않는다. 첫 설치 후 생성한 lockfile은 별도 검토하여 추적한다.


## 기본 실행

Node 24.11.0, npm 11, Docker Compose v2. 현재 개발 환경은 macOS이며 목표 배포는 Linux다. 외부 SDK와 앱 패키지 다운로드가 가능한 네트워크가 필요하다.

```sh
cp .env.example .env
npm install
npm test
npm run dev:api
```

별도 터미널에서 `npm run dev:web`. 웹 `http://localhost:3000`, API `http://127.0.0.1:4000/health`. 웹은 Next rewrite로 `/api` 요청을 API에 전달하므로 CORS 개발 허용 목록을 넓히지 않는다. 루트 dev 명령은 `.env`를 읽는다. 개별 workspace에서 직접 실행하면 루트 `.env`가 자동으로 로드되지 않을 수 있다.

실제 PoC 외부 연결을 하지 않고도 문서·단위 테스트·UI 초기 화면·API disabled 응답을 검증할 수 있다. 이번 실행 환경에서는 dependency 설치 실패로 UI/API 실행은 검증하지 못했다.

첫 성공 설치 후 `package-lock.json`을 검토하고 다음 설치는 `npm ci`를 사용한다. 현재 lockfile이 없어 Docker/CI는 임시로 `npm install` fallback을 사용한다. 이 상태를 재현 가능한 운영 배포로 간주하지 않는다. 전이 의존성 라이선스/보안 감사 후 lockfile을 관리하고 fallback을 제거한다.

## 환경변수

| 변수 | 기본 / 의미 |
|---|---|
| PORT / HOST | 4000 / 127.0.0.1, 로컬 API; Compose 내부만 0.0.0.0 |
| APP_ORIGIN | http://localhost:3000, 요청 Origin 정확히 일치 필요 |
| API_INTERNAL_URL | http://127.0.0.1:4000; 컨테이너 빌드에서는 http://api:4000 |
| POC_ENABLED | false; 명시적 true로 설정해야 토큰 발급 |
| POC_TEACHER_KEY | 최소 32자 운영자 강사 접근키; 브라우저에서 비밀번호 입력 |
| POC_STUDENT_KEY | 최소 32자 학생 시험키; 강사 키와 달라야 함 |
| POC_ROOM | lesora-poc; 서버에서 허용하는 방 한 개 |
| LIVEKIT_URL | 관리형 프로젝트 wss:// URL |
| LIVEKIT_API_KEY / LIVEKIT_API_SECRET | 서버 측 LiveKit credential |
| ZOOM_VIDEO_SDK_KEY / ZOOM_VIDEO_SDK_SECRET | Video SDK 참가 JWT용 credential; Meeting SDK/API key와 구분 |
| POSTGRES_PASSWORD | 로컬 DB 전용 예시값; 실제 서버에서는 변경 |
| ZOOM_COEP | off 또는 require-corp, Zoom SAB 비교용 보안 헤더 실험 |

어떤 secret에도 `NEXT_PUBLIC_` 접두어를 붙이지 않는다. `.env`는 Git/Docker build context에서 제외한다. `infra/Dockerfile`은 env secret을 이미지에 복사하지 않는다. 현재 PoC는 DATABASE_URL, 객체 저장소, 녹화 API credential을 사용하지 않으므로 불필요한 비밀키를 미리 수집하지 않는다.

## 승인된 실제 시험 준비

계정/리소스 생성·녹화 활성화·실제 사용량 발생은 사전 승인 이후 운영자가 진행한다. 이 작업에서는 어떤 계정/리소스도 생성하거나 활성화하지 않았다.

1. 승인된 Zoom Video SDK/LiveKit Cloud 테스트 프로젝트에서 참가 credential을 발급한다. Zoom 일반 Meeting 계정/Meeting SDK와 혼동하지 않는다.
2. `.env`에 선택한 공급자 값과 방을 설정한다. 두 운영자 키는 각각 아래 명령으로 독립 생성한다.

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. 실제 사용량과 녹화 기본 설정을 확인한 뒤 `POC_ENABLED=true`로 변경하고 API를 재시작한다. 이미 계정에서 자동 녹화가 켜져 있으면 참가만으로 녹화 비용이 발생할 수 있으므로 시험 범위/동의를 먼저 확인한다.
4. 두 브라우저에서 같은 방/공급자로 입장한다. 학생에게 강사 키를 전달하지 않는다. 테스트키는 계정 인증을 대체할 수 없고 수업 소속 사용자별 접근 제어도 아니다.
5. 완료 후 PoC를 비활성화하고 키를 교체한다. 토큰의 유효기간 중 이미 발급한 토큰은 남을 수 있으므로 공급자 세션 종료 정책도 적용한다.

Zoom SDK는 init의 Global 미디어 자산을 브라우저에서 받는다. 이는 외부 네트워크가 필요하고 패치 자산의 버전도 실측 시 기록해야 한다. 패키지 버전만으로 모든 WASM 자산이 고정되었다고 간주하지 않는다. npm 레지스트리와 SDK CDN은 서로 다른 접근 요구다.

## HTTPS / SAB / 브라우저

localhost는 장치 접근 시험에 사용할 수 있지만 다른 PC가 일반 HTTP IP 주소로 접속하면 getUserMedia/화면공유가 제한될 수 있다. 여러 실제 PC 시험에는 HTTPS 도메인과 접근 통제가 필요하다. Caddy 예제는 구성 참고용이며 현재 Compose에 프록시/TLS 공개 서비스를 띄우지 않는다.

`ZOOM_COEP=require-corp`는 Next에 COOP same-origin / COEP require-corp를 설정한다. 기본 OFF와 ON을 비교하고 crossOriginIsolated, 브라우저/SAB 상태를 결과에 기록한다. 외부 교재/CDN 자산의 CORS/CORP 응답에 따라 로드가 깨질 수 있으므로 무조건 활성화하지 않는다. Zoom의 enforceMultipleVideos 설정을 켜 두었지만 브라우저별 실제 효과/비용은 시험 대상이다.

Next headers/rewrites는 빌드 설정이므로 Docker 프로덕션에서 바꾸려면 build args/설정을 반영하여 재빌드해야 한다. 현재 Docker에는 API_INTERNAL_URL build arg만 있다. SAB 실험은 로컬 개발 모드에서 먼저 수행한다.

## Docker

```sh
# .env가 먼저 있어야 함
cp .env.example .env
# 구성 검증은 데몬 없이 가능
docker compose --profile app config --quiet
# DB만: Phase 0 앱은 아직 이 DB를 사용하지 않음
docker compose up -d db
# 앱까지
docker compose --profile app up --build
```

web은 localhost:3000, DB는 localhost:5432만 노출하고 API는 Compose 내부다. DB volume은 재시작 후 보존한다. 정상 중지는 `docker compose --profile app down`; `down -v`는 DB 데이터를 지우므로 일반 종료에 사용하지 않는다. 기본 Postgres 예시 비밀번호는 내부 로컬 환경용이다.

제한값은 db 1GB/api 512MB/web 2GB로 시작한다. 이는 미니PC 실제 부하 측정 결과가 아니다. 빌드 중 메모리와 브라우저 테스트 PC 자원은 별개로 측정한다. 백업/복원·TLS·운영 배포 자동화는 Phase 4다.

## 녹화 시험 추가 설정 (아직 소비하는 코드 없음)

Zoom 서버 API credential, webhook secret, 녹화 entitlement/계정 설정과 LiveKit Egress 권한/webhook, 버킷 endpoint·region·접근키가 추가로 필요하다. 최종 저장소를 정한 후 제한된 테스트 버킷 권한을 부여하고 서명 검증 endpoint를 구현한다. 비밀 없는 빈 설정으로 READY를 흉내 내는 기능은 없다. 자세한 작업은 [녹화 설계](recording.md)를 따른다.
