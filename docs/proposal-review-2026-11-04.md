# Gemini 제안 검토 — 2026-11-04

대상: 사용자가 제공한 ‘실시간 온라인 코딩 교육 및 SaaS 플랫폼 (ShareDB 버전)’ 문서. 기존 [Lesora_plan.md](../Lesora_plan.md)를 기준으로 범용 교육, 자동 녹화 필수, RTC 실측 후 선정, 단순한 모듈형 구성을 유지하며 검토했다. 아래 ‘채택’은 계획 반영이며 서비스 구현이나 사업 확정을 뜻하지 않는다.

## 항목별 판정

| 제안 | 판정 | 반영 내용 / 이유 |
|---|---|---|
| K-12 코딩 전용 플랫폼 | 범위 축소 미채택 | K-12는 활용 사례. 한국어·성인·기관까지 범용 플랫폼 유지(1.3절). |
| Zoom Video SDK 최종 선택 | 보류 | LiveKit Cloud와 동등 조건 비교 전 확정하지 않음(4.1절). |
| 카메라+음성+공유 사용 시 추가 비용 없음, 50% 절감 | 근거 불충분 | 미디어 단가와 녹화·저장 포함 총비용 구분. 비교 상품·플랜·조건 불명확. VideoSDK.live로 비교 후보 확대 안 함. |
| $0.0035/분, 1:1 60분 $0.42 | 조건부 산술 예시 | 과거 공식 단가 자료는 존재하나 현재 계정 견적은 아님. 참가자 2명으로 계산한 $0.42는 맞고 녹화 등은 제외(9.4절). |
| Zoom의 공유 회선 성능 우위 | 실측 전 보류 | 공유 회선·여러 강사 PC 동시 수업 시험 추가(5.5절). |
| ShareDB가 Yjs보다 항상 가벼움 | 단정 미채택 | OT/CRDT만으로 메모리 비교 불가. 두 기술 모두 상태·이력 수명 관리 필요(7.5절). |
| ShareDB 중앙 권한/스냅샷 | 대안으로 채택 | 타당한 설계 선택이지만 Hocuspocus에서도 가능. Yjs 우선안 유지, 필요 시 동등 부하 비교. |
| ws 또는 sharedb-client로 동기화 | 설명 수정 | WebSocket 전송과 ShareDB 동기화 클라이언트 역할을 구분. 공식 예제의 sharedb/lib/client와 서버 stream 연결을 기준으로 대안 구현 시 검토. |
| MongoDB 또는 PostgreSQL 자유 대체 | 미채택 | 기본 PostgreSQL 유지. ShareDB PG 어댑터 query 미지원·호환성/유지보수 검증 필요. |
| Redis 캐시 추가 | 조건부 보류 | 실제 병목·다중 인스턴스가 필요할 때 도입. 정확한 ShareDB 어댑터명은 sharedb-redis-pubsub. |
| 외부 강사 선결제 강의실 대여 | 사업 가설 채택 | 출시 후 검토 범위로 구체화. 포함 인원/동시 방/녹화·보관량 정의(3.6절). |
| 시간당 2,000~2,500원, 1,400원 이상 마진 | 확정 미채택 | 가격 가설만 보존. 총비용·환불·지원·크레딧 만료 후 손익 검증(9.4절). |
| 토큰 발급·편집기 연결시간으로 청구 | 수정 채택 | 실제 수업/참가 이벤트와 공급자 사용량 대사로 계량. 고객 청구와 공급자 원가 분리(9.5절). |
| 잔액 소진 시 인터셉터로 연결 종료 | 수정 채택 | 경고·유예·신규 입장 차단·저장·RTC/녹화 종료·실패 복구를 서버에서 관리. |
| Tunnel로 공용 IP/포트포워딩 문제 해소 | 조건부 채택 | 허용된 outbound 연결로 앱 HTTP/WSS 노출. 미디어 회선·인증·가용성 해결책으로 확대 해석하지 않음(8.2절). |
| Compose·환경변수 기반 주소 | 채택/강화 | 이미 선택한 구성 보강. 필요한 프로세스만 포함하고 public/내부 주소·secret 분리(8.4절). |
| 50명 초과 시 $5~$12 VPS로 무중단 운영 | 기준 수정 | 인원 숫자 대신 부하·회선·복구 목표·유료 운영 요구. 단일 VPS 무중단 주장 배제. |
| 잉여 인프라 크레딧 활용 | 미확인 가정 | 크레딧 공급자·잔액·만료·대상 서비스 미확인. 보유를 사실로 가정하지 않음. |

## 공식 자료로 확인한 기술 사실

**ShareDB:** 기본적으로 연산을 저장하며 긴 이력 재구성에 milestone snapshot을 사용할 수 있다. 이는 DB 이력에 대한 설명으로, 모든 이력이 항상 RAM에 올라간다는 의미도 아니다. PostgreSQL 어댑터는 공식 목록에 있지만 query를 지원하지 않는다. Redis Pub/Sub는 인스턴스 간 변경 전달을 담당한다. 따라서 ‘이력을 안 쌓아 무조건 가볍다’, ‘DB 어댑터 기능이 같다’, ‘Redis는 단순 캐시’라는 설명은 채택하지 않았다. [문서 이력](https://share.github.io/sharedb/document-history), [DB 어댑터](https://share.github.io/sharedb/adapters/database), [Pub/Sub](https://share.github.io/sharedb/adapters/pub-sub)

**Yjs/Hocuspocus:** Y.Doc에는 GC 설정이 있고, 바이너리 `mergeUpdates`만으로 삭제 데이터를 GC할 수는 없다. Hocuspocus에는 인증·문서 저장 hook이 있다. 따라서 Yjs의 메모리 상한을 보장하지도, 중앙 관리가 불가능하다고 보지도 않는다. 실제 문서·Monaco 모델·worker·서버 프로세스의 수명과 영속 상태를 따로 측정한다. [Y.Doc](https://docs.yjs.dev/api/y.doc), [업데이트 처리](https://docs.yjs.dev/api/document-updates), [서버 hook](https://tiptap.dev/docs/hocuspocus/server/hooks), [Monaco binding 목록](https://docs.yjs.dev/ecosystem/editor-bindings)

**Zoom:** $0.0035/분은 과거 공식 fact sheet에서 찾을 수 있었다. 현재 공개 요금 페이지는 Build Platform 크레딧 모델을 안내하며, 이 검토에서 계정의 현재 단가·할인·무료 한도를 검증하지 않았다. 녹화는 별도 옵션과 요건을 확인해야 한다. 제안 계산을 ‘거짓’으로 단정하기보다 과거 단가를 사용한 제한된 예시로 분류했다. [과거 단가 자료](https://developers.zoom.us/blog/video-sdk-fact-sheet/), [현재 요금 안내](https://zoom.us/ko/pricing/developer), [녹화](https://developers.zoom.us/docs/video-sdk/web/recording/)

**Cloudflare:** Tunnel은 공개 IP 없이 outbound 연결을 사용할 수 있다. 프록시 WebSocket은 서버 재시작이나 idle timeout으로 종료될 수 있어 재접속이 필요하다. 이는 관리형 RTC와 별도의 앱/공동 편집 연결 경로에 적용하는 설계다. [Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), [WebSocket 제약](https://developers.cloudflare.com/network/websockets/)

**ShareDB 연결 구성:** 공식 예제는 서버 `ws`와 WebSocket→Stream 변환, 클라이언트 `sharedb/lib/client`를 함께 사용한다. 이들을 서로 대체 가능한 통신 라이브러리로 나열하지 않는다. [Getting started](https://share.github.io/sharedb/getting-started)

## 설계 판단과 미확인 영역

계량·크레딧 원장·수업 종료 순서는 Lesora의 수업 연속성과 비용 통제를 위해 도출한 설계 요구다. 공급자 SDK에 완성된 과금 인터셉터가 있다고 주장하는 것이 아니다. 공급자별 강제 종료·재입장 차단·녹화 중지의 실제 API 동작은 PoC 검증 대상이다.

ShareDB/Monaco binding 및 PostgreSQL 어댑터의 실제 패키지 버전, 릴리스·라이선스·보안 상태·유지보수 부담과 부하 테스트는 이번에 검증하지 않았다. 공식 목록 등재가 운영 적합성을 보장하지 않으므로 현재 의존성을 교체하지 않는다. VPS별 최신 견적·가용성 계약도 비교하지 않았으며 제시된 고정 가격을 채택하지 않았다.

## 반영 및 검증 범위

- 계획서 v0.3으로 변경하고 3.6, 5.5, 7.5, 8.4, 9.4~9.5절과 Phase별 작업·미결정 사항·변경 이력을 보강했다.
- 아키텍처·로드맵·RTC 시험 문서에 같은 범위/보류 조건을 반영했다. RTC 선정, Yjs→ShareDB 변경, Mongo/Redis 추가, 결제·배포 구현은 수행하지 않았다.
- 문서 상대 링크·장절 구조·diff 공백 검사와 1:1/1:5/1:10의 조건부 산술 예시 검증을 통과했다. 문서 변경으로 새 앱 테스트를 작성하지 않는다. 원격 CI 결과와 실제 RTC/공동 편집 성능 검증은 별개다.
