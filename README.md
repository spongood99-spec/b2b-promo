# CJ프레시웨이 프로모션 협업 앱

협력사(식자재 제조·공급사)와 CJ프레시웨이 간 프로모션 제안·검토·승인·협의 과정을 하나의 서비스로 통합한 B2B 협업 도구.

## Demo Site

**https://cjk-007-fe.vercel.app**

- 프론트엔드: Vercel (React 19 + Vite)
- 백엔드: Vercel (`https://cjk-007-be.vercel.app`, Node/Express)
- DB: Supabase (PostgreSQL 17)

## 테스트용 사용자 계정

| 역할 | 이메일 | 비밀번호 | 소속사명 |
|---|---|---|---|
| CJ프레시웨이 (관리자) | test-admin@example.com | Test1234! | CJ프레시웨이 |
| 협력사 (사용자) | test-partner@example.com | Test1234! | 테스트협력사 |

## 간략한 테스트 시나리오

1. **협력사 로그인** (`test-partner`) → 목록 화면에서 `[+ 프로모션 등록]` 클릭 → 기간·품목·조건 입력 후 등록 → "제안됨" 상태로 목록에 뜨고 등록 성공 토스트 확인
2. **CJ프레시웨이 로그인** (`test-admin`) → 방금 등록된 프로모션 상세 진입 → EC-01 안내(협력사는 액션 버튼 없음)와 대비해 승인/수정 후 승인/반려 버튼 노출 확인 → **승인** 클릭 → "승인됨" 전이 + 토스트 확인
3. 협력사로 재로그인 → 승인된 프로모션 상세에서 **변경요청 등록**(조건 변경 등) → CJ프레시웨이로 다시 로그인 → 변경요청에 "승인후변경" 태그 확인 → **반영완료** 처리
4. CJ프레시웨이 계정으로 사유 입력 후 **프로모션 취소** → "취소됨" 확인 → **재오픈** 버튼으로 "검토중"으로 되돌리기
5. **캘린더 화면**에서 월/주/일 탭을 전환하며 등록한 프로모션이 기간에 맞춰 표시되는지, 취소/반려된 프로모션은 표시되지 않는지 확인
6. 375px 등 좁은 화면에서 목록이 카드형으로 전환되는지, 목록 행이 키보드 Tab으로 접근되는지 확인
7. 반려된 프로모션을 협력사가 **수정 후 재제출**(FR-12) → 헤더 알림 벨의 안읽은 개수가 올라가는지, 클릭 시 읽음 처리되는지, "전체보기"(`/notifications`)에서 개별/전체 읽음 처리가 되는지 확인(FR-13)
8. 목록 화면 검색창에 조건/품목명/소속사명 일부를 입력해 "조회" → 해당 프로모션만 걸러지는지 확인(FR-14), 목록 상단 통계 바("승인 대기"/"재제출 필요"/"진행중")가 역할에 맞게 표시되는지 확인(FR-16)
9. 프로모션 상세에서 등록일시/최종수정일시가 표시되는지(FR-15), 헤더의 **비밀번호 변경**이 현재 비밀번호 확인 후 정상 동작하는지 확인(FR-11)

## 개발 문서 (`docs/`)

작성 순서이자 근거 우선순위(앞 번호가 뒤 번호의 기준 문서)로 정리되어 있다.

| 문서 | 설명 |
|---|---|
| [`docs/1-domain-definition.md`](docs/1-domain-definition.md) | 도메인 정의서 — 액터/엔티티/유스케이스/예외케이스/MVP 범위 (가장 신뢰도 높은 기준 문서) |
| [`docs/2-prd.md`](docs/2-prd.md) | PRD — 기능요구사항(FR-1~FR-16), 비기능요구사항, 기술스택, 일정 |
| [`docs/2-usecase.md`](docs/2-usecase.md) | 유스케이스 다이어그램 (mermaid) |
| [`docs/4-user-scenario.md`](docs/4-user-scenario.md) | 사용자 시나리오 — P0 기능 중심 흐름 |
| [`docs/5-project-principle.md`](docs/5-project-principle.md) | 프로젝트 구조/레이어/네이밍/테스트/보안 원칙, 디렉토리 구조 |
| [`docs/6-arch-diagram.md`](docs/6-arch-diagram.md) | 기술 아키텍처 다이어그램 — 전체 구성, 인증 흐름, 프론트 컴포넌트 구조 |
| [`docs/7-wireframe.md`](docs/7-wireframe.md) / [`docs/7-wireframe-3-promotion-list.svg`](docs/7-wireframe-3-promotion-list.svg) | 화면 와이어프레임 (데스크톱+반응형) |
| [`docs/8-erd.md`](docs/8-erd.md) / [`docs/8-schema.sql`](docs/8-schema.sql) / [`docs/8-seed.sql`](docs/8-seed.sql) | ERD, DDL, 시드 데이터 |
| [`docs/9-plan.md`](docs/9-plan.md) | 실행 계획 — DB/백엔드/프론트엔드 Task, 선행관계, 완료조건 체크박스 |
| [`docs/10-style.md`](docs/10-style.md) | UI 스타일 가이드 — 컬러/타이포그래피/컴포넌트 스타일 |
| [`docs/swagger.json`](docs/swagger.json) | OpenAPI 스펙 (개발 서버 기동 시 `/api-docs`에서도 확인 가능) |
