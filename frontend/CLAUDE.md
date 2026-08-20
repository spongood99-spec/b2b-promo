# b2b-promotion 프론트엔드앱 개발을 위한 지침

## 기술 스택 (반드시 준수할 것)

`2-prd.md` 6장 기준. 아래 스택 외 다른 라이브러리/프레임워크로 임의 대체하지 말 것.

- **프레임워크**: React 19
- **전역 상태관리**: Zustand — access token 등 클라이언트 전역 상태(메모리 보관, 영속화하지 않음)
- **서버 상태/통신**: TanStack Query — 프로모션/변경요청 등 서버 데이터 fetch/mutate. access token 만료(401) 시 `/auth/refresh` 호출 후 원요청 재시도
- **인증 토큰 보관**: access token은 Zustand(메모리), refresh token은 HttpOnly Secure 쿠키(서버가 관리, 프론트에서 직접 다루지 않음)
- **UI**: 반응형 웹, 데스크톱 우선(`7-wireframe.md` 0장 브레이크포인트 1개 전략을 따름). 별도 CSS 프레임워크/UI 라이브러리는 PRD·프로젝트 구조 원칙에 명시되지 않았으므로 임의 도입 전 확인할 것

## 참조 문서

프론트엔드 작업 전 아래 문서를 우선 참고할 것.

- **도메인 정의서**: [`../docs/1-domain-definition.md`](../docs/1-domain-definition.md) — 액터/엔티티/상태/예외케이스/비즈니스 규칙
- **PRD**: [`../docs/2-prd.md`](../docs/2-prd.md) — 기능요구사항 FR-1~FR-9, 기술스택(React 19 + Zustand + TanStack Query)
- **사용자 시나리오**: [`../docs/4-user-scenario.md`](../docs/4-user-scenario.md) — P0 기능 중심 화면 흐름
- **프로젝트 구조 원칙**: [`../docs/5-project-principle.md`](../docs/5-project-principle.md) — 레이어/네이밍/테스트/보안 원칙 (프론트엔드 디렉토리 구조는 6장)
- **아키텍처 다이어그램**: [`../docs/6-arch-diagram.md`](../docs/6-arch-diagram.md) — 기술 아키텍처 및 프론트엔드 컴포넌트 구조
- **와이어프레임**: [`../docs/7-wireframe.md`](../docs/7-wireframe.md), [`../docs/7-wireframe-3-promotion-list.svg`](../docs/7-wireframe-3-promotion-list.svg) — 화면 구성 및 반응형 브레이크포인트 전략
- **UI 스타일 가이드**: [`../docs/10-style.md`](../docs/10-style.md) — 컬러/타이포그래피/컴포넌트 스타일
- **실행 계획**: [`../docs/9-plan.md`](../docs/9-plan.md) — FE Task별 작업 내용·완료조건
- **OpenAPI 스펙**: [`../docs/swagger.json`](../docs/swagger.json) — 백엔드 API 명세 (개발 서버 기동 시 `/api-docs`에서도 확인 가능)
