# 데이터 모델과 API 계약

아래 운영 모델은 **설계**이며 아직 DB migration/인증 API를 구현하지 않았다. Phase 0 API는 DB에 쓰지 않는다.

## PostgreSQL 모델

모든 id는 UUID, 시각은 timestamptz(UTC 저장), bytes는 bigint. 저장 객체 키와 공급자 ID를 분리하고 영상 BLOB은 저장하지 않는다.

| 테이블 | 핵심 필드 / 제약 |
|---|---|
| users | id PK, email UNIQUE(normalized), password_hash, display_name, role(ADMIN/TEACHER/STUDENT), status |
| courses | id, owner_id FK users, subject 일반 문자열, title, workspace_kind, settings jsonb |
| enrollments | id, course_id FK, student_id FK, status, UNIQUE(course_id,student_id) |
| lessons | id, course_id FK, starts_at, ends_at, status, media_provider, provider_session_id, version; ends_at>starts_at |
| lesson_participants | id, lesson_id FK, user_id FK, first_joined_at, last_left_at, UNIQUE(lesson_id,user_id) |
| attendance_events | id, participant_id FK, provider_event_id, event_type, occurred_at, received_at; UNIQUE(provider,event_id) |
| chat_messages | id, lesson_id FK, sender_id FK, message_id UUID, body bounded, sent_at(server), UNIQUE(lesson_id,sender_id,message_id) |
| recordings | id, lesson_id FK, provider, provider_recording_id, attempt, status, error_code, started_at, ended_at; UNIQUE(provider,provider_recording_id) |
| recording_files | id, recording_id FK, output_kind, segment_index, storage_key UNIQUE, duration_sec, size_bytes, checksum, verified_at |
| recording_consents | id, lesson_id FK, user_id FK, policy_version, agreed_at, revoked_at; UNIQUE(lesson_id,user_id,policy_version) |
| lesson_files | id, lesson_id FK, storage_key UNIQUE, file_name, content_type, size_bytes, owner_id FK, status |
| lesson_notes | id, lesson_id FK, author_id FK, visibility, body, version |
| assignments/submissions | id, lesson_id/assignment_id FK, owner/student_id FK, file_id FK, submitted_at |
| code_documents | id, lesson_id FK, path, language, snapshot_key, updated_at, UNIQUE(lesson_id,path) |
| code_updates | id, document_id FK, sequence, storage_key/binary CRDT update, received_at; UNIQUE(document_id,sequence) |
| webhook_events | id, provider, provider_event_id, payload_hash, received_at, processed_at, error; UNIQUE(provider,provider_event_id) |
| jobs | id, type, aggregate_id, idempotency_key UNIQUE, state, attempt, next_attempt_at, lease_until |
| audit_events | id, actor_id FK, action, resource_id, reason, occurred_at; append-only |

보조 인덱스: lessons(course_id,starts_at), enrollments(student_id,status), chat_messages(lesson_id,sent_at,id), recordings(lesson_id,status), jobs(state,next_attempt_at), attendance_events(participant_id,occurred_at). 원본 웹훅 payload는 최소 필드만 보존하고 접근/보관 기간을 제한한다. payload 전체를 기본 로그에 출력하지 않는다.

`recording_files`는 재접속으로 세션이 갈라지거나 여러 레이아웃이 생기는 경우를 지원한다. READY 조건은 필요한 모든 파일의 검증 완료다. 단일 storage_key를 recordings 하나에만 둬서 파일을 덮어쓰지 않는다. 재시도는 새 attempt로 만들며 FAILED 이력을 지우지 않는다. 향후 organizations 도입은 별도 migration; 현재 courses 소유권을 테넌트 격리 완료로 오해하지 않는다.

## 현재 구현된 HTTP API

브라우저 `/api/*` → Next rewrite → 아래 Express 경로.

| 경로 | 요청 / 응답 |
|---|---|
| GET /health | `{status:"ok",phase:0,persistence:false}`; DB ready 확인이 아님 |
| GET /poc/status | enabled 및 recording 미구현 상태; 키 값 노출 없음 |
| POST /poc/join-token | Bearer 운영자 키, JSON `{provider:"zoom" 또는 "livekit",room:"lesora-poc",name:"..."}` |

토큰 응답: Zoom `{provider,token,room,name}` / LiveKit `{provider,token,url,room,name}`. 서버가 역할·identity를 결정하며 요청에서 역할 변경을 허용하지 않는다. 서버 설정에 지정한 한 방만 허용한다. 표시 이름은 1~64자, 방 이름은 영숫자/하이픈/밑줄 최대 64자. 응답은 no-store다.

오류: 400 입력/JSON, 401 키 불일치, 403 PoC 비활성·방·Origin 제한, 413 본문 4KB 초과, 429 IP당 30회/분, 503 미설정 키, 500 공급자/내부 오류. 속도 제한은 단일 프로세스이며 Next proxy 뒤의 요청들은 같은 IP 버킷을 공유할 수 있다. 운영 환경용 분산 제한으로 간주하지 않는다.

Zoom 토큰: 공식 최소 TTL을 고려한 약 30분, iat 30초 유예, topic/role/user_key/version 서명. LiveKit: 10분, 지정 방 join/publish/subscribe/data, roomAdmin/roomRecord false. 이 값은 수업·동의 승인 완료를 의미하지 않는다. PoC host 키는 Zoom 호스트 권한이므로 신뢰하는 운영자만 보유한다.

## 이후 구현 API

| 경로 | 권한 / 핵심 동작 |
|---|---|
| POST /auth/login, /auth/logout | 계정 인증, HttpOnly Secure 세션, CSRF 정책 |
| GET /lessons | 본인 수강/소유 수업만, cursor pagination |
| POST /lessons | 강사 본인 course 소유권 |
| GET /lessons/:id | 소유/수강/허가된 관리자 |
| POST /lessons/:id/join-token | 계정 상태·시간·수강 관계·동의 확인, 안정적 participant identity |
| POST /lessons/:id/start, /end | 소유 강사, Idempotency-Key, lesson version 확인 |
| GET /lessons/:id/participants | 허가된 참가자, 개인정보 최소화 |
| GET/POST /lessons/:id/messages | 수강 권한, client message_id 멱등, 서버 저장 후 WebSocket 전달 |
| GET /lessons/:id/recordings | 실제 참가 기록 + 공개 허용, READY만 재생 가능 |
| POST /recordings/:id/playback-url | 권한 재검사 후 5분 등 짧은 TTL(정책 확정 필요), no-store |
| POST /webhooks/media/zoom, /livekit | 로그인 대신 raw-body 공급자 서명·시각 검증, durable inbox 저장 후 ACK |
| GET /lessons/:id/state | 재연결 시 lesson version, chat cursor, recording status, workspace snapshot |

start/end 및 녹화 요청은 DB 트랜잭션+outbox로 일관성을 보장한다. 외부 SDK 호출을 DB 트랜잭션 안에서 장시간 기다리지 않는다. 웹훅 인증 없는 디버그 endpoint를 운영 환경에 두지 않는다. 현재 웹훅 경로는 구현되지 않아 404를 반환한다.
