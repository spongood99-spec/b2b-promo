# b2b-promo 프로젝트의 최상위 지침

## 반드시 준수할 최우선 지침

- 모든 대화는 한국어로 할 것
- 오버엔지니어링 금지

## 개발할 때 다음 사항을 준수할 것

- 안드레 카파시의 CLAIDE.md
- https://raw.githubusercontent.com/multica-ai/andrej-karpathy-skills/refs/heads/main/CLAUDE.md

## docs 디렉토리 참조

작업 전 아래 문서를 우선 참고할 것 (숫자는 작성 순서이자 근거 우선순위 — 앞 번호가 뒤 번호의 기준 문서).

- `docs/1-domain-definition.md` — 도메인 정의서 (액터/엔티티/유스케이스/예외케이스/MVP 범위, 가장 신뢰도 높은 기준 문서)
- `docs/2-prd.md` — PRD (기능요구사항 FR-1~FR-9, 비기능요구사항, 기술스택, 일정)
- `docs/2-usecase.md` — 유스케이스 다이어그램 (mermaid)
- `docs/4-user-scenario.md` — 사용자 시나리오 (P0 기능 중심 흐름)
- `docs/5-project-principle.md` — 프로젝트 구조/레이어/네이밍/테스트/보안 원칙, 디렉토리 구조
- `docs/6-arch-diagram.md` — 기술 아키텍처 다이어그램 (전체 구성, 인증 흐름, 프론트 컴포넌트 구조)
- `docs/7-wireframe.md`, `docs/7-wireframe-3-promotion-list.svg` — 화면 와이어프레임 (데스크톱+반응형)
- `docs/8-erd.md`, `docs/8-schema.sql`, `docs/8-seed.sql` — ERD, DDL, 시드 데이터
- `docs/9-plan.md` — 실행 계획 (DB/백엔드/프론트엔드 Task, 선행관계, 완료조건 체크박스)
- `docs/swagger.json` — OpenAPI 스펙

새 기능/화면/API를 다룰 때는 도메인 정의서와 PRD를 먼저 확인하고, 실제 구현은 `9-plan.md`의 Task와 완료조건을 따를 것.
