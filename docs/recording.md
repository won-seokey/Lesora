# 자동 녹화와 기록 처리 설계

**구현 상태:** 이번에는 상태 전이 계약/단위 테스트와 아래 통합 설계만 제공한다. 실제 녹화 API, 웹훅 수신·서명 검증, DB inbox/jobs, 파일 이관, 다시보기는 미구현이다. 계정 자동 녹화 설정을 변경하거나 Egress를 실행하지 않았다. Phase 0 완료 전 이 경로를 실제 검증해야 한다.

## 시작·종료·복구

1. 수업 시작 요청에서 강사 소유권, 수업 상태, 고지·필요 동의, 저장 정책을 확인한다. 학생 입장이 자동으로 수업 시작을 의미하지 않도록 한다.
2. DB 트랜잭션으로 lesson RUNNING 및 recording attempt/REQUESTED job을 저장한다. 수업 ID+attempt를 idempotency key로 쓴다.
3. 외부 공급자 요청은 트랜잭션 밖에서 실행한다. API 수락과 녹화 개시를 구분하고 녹화 시작 확인 전에는 UI에 ‘요청 중’으로 표시한다.
4. 공급자 이벤트 또는 조회로 RECORDING을 확인한다. 시작 지연 타임아웃이면 실패/경보 후, 공급자 상태 재조회로 이미 시작된 작업과 중복 실행을 피한다.
5. 종료 명령은 STOPPING, 공급자 최종화는 PROCESSING. 완료 이벤트를 받았어도 자체 저장이 끝나기 전 READY로 표시하지 않는다.
6. UPLOADING 단계에서 모든 출력 파일 크기/길이/형식/해시 또는 동등한 무결성과 실제 재생을 검증한 후 READY. 0바이트, 누락 트랙, 잘못된 파일은 FAILED.
7. 실패는 attempt에 남긴다. 새 녹화 또는 이관 재시도는 별도 job/attempt이며 이전 실패 기록을 덮어쓰지 않는다. 이관 실패가 새 녹화 시작으로 이어지지 않도록 작업 유형을 분리한다.

강사가 일시적으로 나갔다고 바로 수업 종료·녹화 종료로 판단하지 않는다. grace period는 실제 사용 정책으로 정한다. 공급자 세션 재생성/여러 조각은 recording_files로 표현하고 누락 시간대를 보여준다. 웹훅 시간과 서버 수신 시간을 모두 저장한다.

## 공급자별 경로

| 항목 | Zoom Video SDK | LiveKit Cloud |
|---|---|---|
| 자동 시작 | 계정 자동 녹화 또는 서버 recording.start; 첫 참가자가 학생일 때의 시작 시점 확인 필요 | 명시적 room 생성의 Auto Egress 또는 startRoomCompositeEgress; 수업 시작/동의 전 방 생성과 녹화 분리 |
| 인증 | 클라이언트 SDK credential과 서버 API credential 구분 | 서버 API key/secret, 참가자 토큰에 roomRecord 부여 안 함 |
| 완료 | session.recording_completed 및 상태 조회 | egress_ended 및 EgressInfo 상태/오류 확인; ‘ended’만으로 성공 처리 금지 |
| 저장 | 공식 BYOS는 Amazon S3. R2는 다운로드 후 자체 이관 경로 검증 | S3 output 설정 및 endpoint로 대상 호환성 검증; R2 지원은 실제 쓰기·읽기까지 시험 |
| 복수 출력 | 레이아웃/음성/공유 파일 및 청구 단위 구분 | RoomComposite, participant/track 별 출력과 사용량 구분 |
| 자체 UI | 기본 녹화가 채팅/Monaco DOM을 자동 포함하지 않음 | 기본 Composite도 자체 DOM을 자동 포함하지 않음. 별도 web/custom template 가능성 검증 |

미니PC는 다운로드→업로드를 스트리밍하여 메모리에 전체 파일을 올리지 않는다. 임시 디스크를 쓸 경우 용량 한도·중단 재개·정리 정책을 두며 미디어 인코딩은 하지 않는다. 다운로드 URL은 공급자 allowlist, HTTPS, 리다이렉트 재검증, 크기/시간 제한으로 SSRF를 방어한다. URL query의 공급자 토큰을 로그에 남기지 않는다.

## 웹훅 신뢰 경계

- 원본 body bytes를 보존하고 JSON 파싱 전/동일 원본으로 검증한다.
- Zoom은 검증용 challenge 응답과 실제 이벤트의 서명 검증을 분리한다. timestamp window, v0 서명 HMAC, timing-safe 비교, 이벤트 ID 또는 canonical hash 기반 멱등 키를 구현·테스트한다.
- LiveKit은 공식 서버 SDK WebhookReceiver 검증 경로를 사용하고 인증 토큰+body hash를 검증한다.
- 검증된 이벤트를 PostgreSQL inbox에 durable insert 후 ACK. 재전송은 unique constraint로 멱등 처리한다.
- 역순/지연 이벤트가 READY를 RECORDING으로 되돌리지 않도록 공급자 상태를 재조회한다. 웹훅만으로 전체 상태를 확정하지 않는다.
- 외부 조회/이관 작업은 lease와 제한된 재시도(지수 backoff+jitter), dead-letter 표시 및 관리자 재처리 기능을 둔다.
- REQUESTED/STOPPING/PROCESSING이 임계시간을 넘는 레코드를 주기적으로 조회하여 누락 웹훅을 복구한다.

## 채팅·코드·자료·접근

채팅은 서버 저장 완료 뒤 전달한다. 공동 코드는 Yjs 상태와 스냅샷/변경 로그로 따로 보존한다. 각각 lesson timeline의 서버 기준 시각을 사용한다. 영상 안에 코드가 필수이면 강사 화면공유 지침 또는 별도 녹화용 페이지를 검증해야 한다. 녹화 전용 페이지에는 수업 외 개인정보가 노출되지 않게 한다.

비공개 버킷, 서버 수업/참여/공개 권한 확인, 단기 서명 URL, 재생 요청 감사가 기본이다. 녹화 고지·동의, 미성년자, 국외 처리, 보관/탈퇴 삭제는 운영 전 별도 정책 검토 대상이며 본 문서는 법률 판단을 제공하지 않는다. 공급자 원본/자체 버킷/백업/임시 파일까지 삭제 범위를 추적한다.

## PoC 합격 증거

동일 시험 수업에서 음성·카메라·화면공유 구간을 표시하고 최종 파일을 실제 재생한다. 시작/종료 API 시각, 확인 이벤트 시각, 웹훅 검증, 오브젝트 크기·길이, 재생 결과, 누락/분할 구간을 기록한다. 중복/역순/유실 웹훅, 녹화 실패, 이관 실패, 동의 없는 시작, 권한 없는 재생을 각각 시험한다. 시뮬레이션만 통과한 항목은 실제 녹화 성공률에 포함하지 않는다.
