# 공식 근거와 버전 확인

확인일: 2026-10-31. 웹 공식 자료 확인과 실제 SDK 실행 검증을 구분한다. 페이지 표시 버전/레지스트리 캐시는 시점 차이가 날 수 있으므로 설치 후 lockfile·타입 선언·공급자 릴리스 노트를 함께 확인한다.

| 자료 | 적용한 판단 |
|---|---|
| [Next 설치](https://nextjs.org/docs/app/getting-started/installation) | App Router, TS, 현재 문서 v16.4.3, Node/브라우저 요구 확인. npm 실제 설치는 차단됨. |
| [Express 5 API](https://expressjs.com/en/5x/api/) | 단일 모듈형 API의 기본 프레임워크. async handler 오류 경계를 둠. |
| [Zoom SDK 인증](https://developers.zoom.us/docs/video-sdk/auth/) | 서버 서명, topic/role/version/iat/exp, 최소 1800초. 최신 문서 user_key 명칭 적용(이전 user_identity). |
| [Zoom credential](https://developers.zoom.us/docs/video-sdk/get-credentials/) | SDK 참가 credential과 서버 API credential을 구분. |
| [Zoom 영상](https://developers.zoom.us/docs/video-sdk/web/video/) | attachVideo/detachVideo, WebAssembly 다중 영상의 SAB/enforceMultipleVideos 조건. |
| [Zoom 화면공유](https://developers.zoom.us/docs/video-sdk/web/share/) | 브라우저에 따라 video/canvas 송신, 브라우저 종료 이벤트. |
| [Zoom Stream reference](https://marketplacefront.zoom.us/sdk/custom/web/modules/Stream.html) | startShareView/stopShareView 기존 canvas 경로 참고. 참조 페이지 표기는 2.2.0이므로 설치할 2.6.0 타입/동작 대조 필요. |
| [Zoom AudioOption](https://marketplacefront.zoom.us/sdk/custom/web/interfaces/AudioOption.html) | startAudio mute 옵션 확인. |
| [Zoom 브라우저 지원](https://developers.zoom.us/docs/video-sdk/web/browser-support/) | 주요 브라우저별 지원 차이, 설치 없는 웹 지원을 무조건 동일 기능으로 가정하지 않음. |
| [Zoom SAB](https://developers.zoom.us/docs/video-sdk/web/sharedarraybuffer/) | COOP/COEP 및 멀티 영상 실험 조건. |
| [Zoom 녹화](https://developers.zoom.us/docs/video-sdk/web/recording/) | 관리형 녹화, 완료 이벤트/파일 확인 별도 필요. |
| [Zoom BYOS](https://developers.zoom.us/docs/build/storage/) | Amazon S3 직접 저장. R2 직접 BYOS 호환으로 간주하지 않음. |
| [LiveKit subscribe](https://docs.livekit.io/transport/media/subscribe/) | Track.attach를 쓰는 adaptiveStream, 표시/크기에 따른 최적화 및 명시적 구독. |
| [LiveKit JS 공식 저장소](https://github.com/livekit/client-sdk-js) | Room/track API, SDK 공급자별 렌더 구조 분리. |
| [LiveKit Egress](https://docs.livekit.io/transport/media/ingress-egress/egress/) | 외부 관리형 녹화/출력 파이프라인. |
| [LiveKit Auto Egress](https://docs.livekit.io/transport/media/ingress-egress/egress/autoegress/) | room 생성과 자동 녹화 연결, 운영 동의/수업 시작 게이트 필요. |
| [Zoom 요금](https://zoom.us/ko/pricing/developer) / [LiveKit 요금](https://livekit.com/pricing) | 사용량/기본료 모델 재확인. 계정 견적·실제 청구 미검증. |

발행자가 관리하는 배포 메타데이터에서 확인한 SDK 버전: [Zoom 2.6.0](https://www.npmjs.com/package/%40zoom/videosdk?activeTab=versions), [LiveKit client 2.23.0](https://www.npmjs.com/package/livekit-client?activeTab=versions), [LiveKit server 2.19.1](https://www.npmjs.com/package/livekit-server-sdk?activeTab=versions). 서버 SDK 다른 캐시에서는 2.19.2도 표시되었으나 이번에는 확인 가능한 2.19.1로 고정했다. Zoom 배포 메타데이터는 별도 LICENSE.md 적용, LiveKit은 Apache-2.0을 명시한다.

브라우저 실제 성능·과금·녹화 완전성에 관한 결론은 위 문서만으로 내리지 않는다. 공급자 선정 ADR은 시험 증거가 준비된 후 작성한다.
