# PR-Agent AI 코드 리뷰

## 구성 및 상태

`.github/workflows/pr-agent.yml`이 공식 PR-Agent 컨테이너를 GitHub 표준 Ubuntu 러너에서 실행한다. 별도 Ubuntu PC나 PR-Agent 서버는 필요하지 않다. CLI의 `review` 명령만 실행하며 PR 설명 변경·코드 수정·자동 승인·병합은 수행하지 않는다.

2026-11-04 구성: 공식 `pragent/pr-agent:github_action` manifest를 조회해 아래 digest로 고정했다. 변경 가능한 `main` Action이나 Docker 태그를 실행 시 따라가지 않는다.

```text
pragent/pr-agent@sha256:b1ed6e8de56eb4d6e4169ee0d5c209bb5ed1ef071a01c0c042c64b80192a785c
```

고정 시점 upstream main: `10f6429f22c2fafb54d54600085e299efbc8190e`. 이는 설정/API 참조 코드이며 이미지 내용과 동일한 source commit임을 보장하는 증명은 아니다. 업데이트 시 upstream 설정·보안 공지와 manifest를 재검토한 PR로 변경한다. `actions/github-script`도 커밋 SHA로 고정했다.

기본은 **dry-run**이다. Secret을 등록하는 것만으로 API 호출이 시작되지 않는다. 키 없는 dry-run은 대상 PR/모델명/분량/실행 조건을 검사하지만 인증·모델 접근·리뷰 품질을 검증하지 않는다. 실제 모델 호출은 아직 실행하지 않았다.

## GitHub에 등록할 Secrets

저장소 **Settings → Secrets and variables → Actions → Secrets → New repository secret**에서 등록한다.

| Secret 이름 | 값 | PR-Agent 내부 전달 |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio의 Gemini Developer API 키 | `GOOGLE_AI_STUDIO__GEMINI_API_KEY` |
| `DEEPSEEK_API_KEY` | DeepSeek API 키 | `DEEPSEEK__KEY` |
| `OPENAI_API_KEY` | OpenAI 프로젝트 API 키 | `OPENAI__KEY` |

전부 등록해도 되지만 선택한 공급자의 키만 컨테이너에 전달한다. `GITHUB_TOKEN`은 GitHub가 자동 발급하므로 별도 PAT를 등록하지 않는다. ChatGPT/Google AI Pro 구독과 API 프로젝트의 결제·사용량은 별도로 확인한다. 키를 PR 댓글·채팅·코드·일반 Variables에 넣지 않는다.

## GitHub에 등록할 Variables

같은 페이지의 **Variables** 탭에 등록한다. 모델 이름은 비밀정보가 아니다.

| Variable 이름 | 값 / 역할 |
|---|---|
| `PR_AGENT_MODEL_GEMINI` | `gemini/<사용 가능한 API 모델 ID>` |
| `PR_AGENT_MODEL_DEEPSEEK` | `deepseek/<사용 가능한 API 모델 ID>` |
| `PR_AGENT_MODEL_OPENAI` | `openai/<사용 가능한 API 모델 ID>` |
| `PR_AGENT_PROVIDER` | 자동 리뷰 기본 공급자: `gemini`, `deepseek`, `openai` 중 하나; 미설정 시 gemini |
| `PR_AGENT_AUTO_REVIEW` | 미설정/false: PR 이벤트는 dry-run, 명시적 `true`: 비-Draft 내부 PR 자동 리뷰 활성화 |

모델별 실제 사용 가능 여부·가격·무료 할당량을 각 계정에서 확인하고 전체 LiteLLM 모델명을 넣는다. 표의 `<...>`는 설명용 자리표시자이며 그대로 입력하지 않는다. 특정 유료 모델을 기본값으로 고정하지 않았다. 모델이 미설정된 실제 실행은 오류로 종료하며 다른 모델/공급자로 자동 전환하지 않는다.

## 처음 실행하는 방법

1. 우선 사용할 공급자의 Secret과 모델 Variable을 등록한다. 나머지는 나중에 등록해도 된다.
2. 기존 정책대로 워크플로 변경을 리뷰하고 사용자 승인 후 main에 병합한다. **현재 main은 빈 초기 커밋이므로 이 워크플로가 main에 병합되기 전에는 Actions의 workflow_dispatch 실행 버튼/API를 사용할 수 없다.** 현재 내부 PR 이벤트의 dry-run으로 기본 구성을 확인한다.
3. 병합 후 **Actions → AI PR Review → Run workflow**에서 workflow ref는 신뢰하는 `main`, 대상 열린 PR 번호, 공급자를 고르고 `dry_run=true`로 먼저 검사한다.
4. 실제 사용량 발생을 승인할 때 `dry_run=false`로 수동 실행한다. 한국어 리뷰 댓글과 실제 토큰 사용량/모델 호환성을 확인한다. 수동 실행은 내부 Draft PR도 대상으로 할 수 있다.
5. 결과와 비용이 적절하면 `PR_AGENT_AUTO_REVIEW=true`, 원하는 `PR_AGENT_PROVIDER`를 설정한다. PR 생성·재오픈·리뷰 준비·새 push 시 비-Draft PR을 리뷰한다. 중지하려면 이 변수를 false로 바꾼다.

초기 PR #1은 30개 파일을 초과해 실제 리뷰 분량 제한으로 건너뛴다. 제한을 임의로 해제하지 않고 초기 구현은 로컬 코드 리뷰 또는 분할 검토를 수행하고, 작은 후속 PR에서 API 연동을 시험한다. dry-run 성공을 초기 구현의 AI 리뷰 완료로 취급하지 않는다.

## 실행 범위와 비용 제어

- 대상은 같은 저장소에서 생성된, main을 대상으로 하는 열린 PR이다. fork PR과 Bot PR의 자동 실행은 제외한다.
- PR 코드 checkout, public issue/comment 명령, `pull_request_target`은 사용하지 않는다. 검토 대상은 API로 읽으며 PR의 코드·설정 파일을 실행하거나 PR-Agent 설정으로 로드하지 않는다.
- 리뷰 인스턴스는 contents read 및 PR/issue write 권한만 사용한다. 코드 쓰기·자동 병합 권한을 부여하지 않는다. Gemini/OpenAI/DeepSeek API 키는 컨테이너 인자에 값으로 삽입하지 않는다.
- PR당 30개 파일/3,000 변경 행을 넘으면 API 호출 전에 건너뛰고 Summary에 표시한다. 이를 승인된 리뷰로 해석하지 않는다.
- 입력 컨텍스트 상한 12,000 토큰, 출력 2,000 토큰, 모델 호출 timeout 120초, job 10분 제한을 둔다. 출력 제한은 일부 reasoning 모델에서 답변 부족/호환성 오류를 유발할 수 있어 수동 시험 후 조정한다.
- fallback과 PR-Agent 재시도를 끄고 `/review`만 실행한다. 이는 통화 기준의 확정 지출 상한이나 전체 네트워크 호출 1회 보장은 아니다. 공급자별 사용량/크레딧 한도도 설정한다.
- 같은 PR에 새 실행이 생기면 기존 job을 취소한다. 이미 공급자가 처리한 호출의 비용은 취소로 환불되지 않을 수 있다.
- 코드/PR 내용은 선택한 모델 제공자에게 전송된다. 무료 Gemini API는 데이터 사용 조건을 별도로 확인한다.

AI 리뷰는 보조 의견이다. 기존 `Checks / check`가 필수 CI이고 AI 리뷰를 필수 상태 검사로 추가하지 않았다. API 키 누락/호환성/무료 한도 문제와 실제 코드 문제를 구분한다. 오류·skip·부분 컨텍스트를 리뷰 통과로 표시하지 않는다. 사용자 승인 후 squash merge 정책을 유지한다.

## 검증

로컬 actionlint v1.7.12의 workflow 구문/표현식 검사와 Bash 문법 검사를 통과했다. plan script의 dry-run·세 공급자 선택·모델/PR 검증·분량 제한·Draft 건너뛰기 등 13개 조건을 가짜 API 응답으로 검증했다. Docker 데몬이 실행 중이지 않아 로컬 컨테이너 실행은 검증하지 않았다. 실제 credential 인증, 모델 호출, PR 댓글 생성은 사용자가 Secrets/모델 Variables를 등록한 뒤 수동 시험해야 한다.

공식 자료: [GitHub 통합](https://docs.pr-agent.ai/installation/github/), [모델 변경](https://docs.pr-agent.ai/usage-guide/changing_a_model/), [upstream 설정](https://github.com/The-PR-Agent/pr-agent/blob/main/pr_agent/settings/configuration.toml), [공식 Action](https://github.com/The-PR-Agent/pr-agent/blob/main/action.yaml).
