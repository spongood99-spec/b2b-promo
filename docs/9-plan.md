# 실행 계획 - CJ프레시웨이 프로모션 협업 앱

> 기준 문서: `2-prd.md`(FR-1~FR-9), `5-project-principle.md`(디렉토리/레이어 구조), `7-wireframe.md`(화면), `8-schema.sql`(DDL)
> 전제: 3일 / 1인 개발 MVP. P0(FR-1~FR-5, FR-7)를 먼저 끝내고, P1(FR-8, FR-9)은 시간이 남을 때만 착수한다.

## Task 의존 관계 요약

```
DB-1 → DB-2
  ↓
BE-1 → BE-2 → BE-3 → BE-4 → BE-5 → BE-6 → BE-7 → (BE-8: P1)
         ↓       ↓      ↓       ↓       ↓
FE-1 → FE-2    FE-3   FE-4    FE-5    FE-6 → FE-7 → FE-8
```

- 백엔드 API가 있어야 프론트 화면을 붙일 수 있으므로 FE-n은 대응하는 BE-n에 의존한다.
- FE-1(프로젝트 셋업)은 BE와 무관하게 먼저 시작 가능하다.

---

## 1. 데이터베이스

### DB-1. 데이터베이스 생성 및 스키마 적용
- **선행 Task**: 없음
- **작업 내용**: PostgreSQL 17 데이터베이스를 생성하고 `8-schema.sql`을 실행해 5개 테이블(users, promotions, items, promotion_items, change_requests)을 만든다. 접속 문자열을 `.env`의 `DATABASE_URL`로 관리하고 `.env.example`을 커밋한다.
- **완료 조건**
  - [ ] `8-schema.sql` 실행 시 오류 없이 5개 테이블이 생성된다
  - [ ] `\d promotions`로 status CHECK 제약(7개 값)과 proposer_id/reviewer_id FK가 확인된다
  - [ ] `.env`에 `DATABASE_URL`이 설정되고 `.env.example`이 저장소에 있다 (`.env`는 .gitignore 대상)

### DB-2. 시드 데이터 준비
- **선행 Task**: DB-1
- **작업 내용**: 개발/테스트용 계정과 샘플 프로모션을 넣는다. 협력사 담당자 2명(서로 다른 소속사), CJ프레시웨이 담당자 1명, 상태가 서로 다른 프로모션 3~4건(제안됨/승인됨/종료).
- **완료 조건**
  - [ ] 협력사 계정 2개, CJ프레시웨이 계정 1개가 users에 존재한다 (비밀번호는 해시 저장)
  - [ ] 서로 다른 status를 가진 프로모션이 3건 이상 존재하고 promotion_items로 품목이 연결되어 있다
  - [ ] 시드 스크립트를 반복 실행해도 중복 없이 초기화된다

---

## 2. 백엔드

### BE-1. 프로젝트 셋업 및 공통 인프라
- **선행 Task**: DB-1
- **작업 내용**: Express 앱 골격을 만든다. `5-project-principle.md` 7장 구조(`src/db/pool.js`, `src/middlewares/`, `src/routes/`, `src/controllers/`, `src/services/`, `app.js`, `server.js`)를 그대로 따른다. pg Pool 생성, 공통 에러 핸들러(`{ error: { code, message } }` 단일 포맷), CORS(credentials 허용) 설정 포함.
- **완료 조건**
  - [ ] `npm start`로 서버가 기동되고 헬스체크 요청이 200을 반환한다
  - [ ] pool을 통해 DB 쿼리가 성공한다 (예: `SELECT 1`)
  - [ ] 존재하지 않는 경로 요청 시 공통 에러 포맷 `{ error: { code, message } }`로 404가 반환된다

### BE-2. 인증 API (FR-1)
- **선행 Task**: BE-1
- **작업 내용**: 회원가입/로그인/토큰 재발급 API를 만든다. `POST /auth/signup`(role, 소속사명, 이메일, 비밀번호), `POST /auth/login`, `POST /auth/refresh`. 비밀번호는 bcrypt 해시 저장, access token은 응답 바디로, refresh token은 HttpOnly Secure 쿠키로 내려준다.
- **완료 조건**
  - [ ] 회원가입 후 동일 이메일로 재가입 시 409가 반환된다
  - [ ] 로그인 성공 시 access token(바디) + refresh token(HttpOnly 쿠키)이 발급된다
  - [ ] 잘못된 비밀번호로 로그인 시 401과 오류 메시지가 반환된다 (EC-06)
  - [ ] refresh 쿠키로 `/auth/refresh` 호출 시 새 access token이 발급된다

### BE-3. 인증/권한 미들웨어
- **선행 Task**: BE-2
- **작업 내용**: `middlewares/auth.js`(Authorization 헤더의 access token 검증 후 `req.user` 주입)와 `middlewares/requireRole.js`(협력사/CJ프레시웨이 역할 체크)를 만든다.
- **완료 조건**
  - [ ] 토큰 없이 보호된 API 호출 시 401이 반환된다
  - [ ] 만료된 access token으로 호출 시 401이 반환된다 (프론트의 refresh 재시도 트리거)
  - [ ] 권한이 없는 역할로 호출 시 403이 반환된다

### BE-4. 프로모션 등록·조회 API (FR-2, FR-7)
- **선행 Task**: BE-3
- **작업 내용**: `POST /promotions`(협력사만, 기간·대상 품목·조건 입력, 품목명은 즉시 items에 생성 후 promotion_items 연결), `GET /promotions`(역할별 조회 범위 + 상태 필터), `GET /promotions/:id`, `GET /promotions?from=&to=`(캘린더용 기간 조회).
- **완료 조건**
  - [ ] 협력사 계정으로 등록 시 status가 `proposed`로 생성되고 품목이 promotion_items에 연결된다
  - [ ] 필수값(기간/대상 품목/조건) 누락 시 400과 오류 메시지가 반환된다
  - [ ] 협력사 계정 조회 시 본인이 등록한 프로모션만, CJ프레시웨이 계정 조회 시 전체가 반환된다
  - [ ] CJ프레시웨이 계정으로 등록 시도 시 403이 반환된다
  - [ ] 기간 조회로 특정 월/주/일과 겹치는 프로모션만 반환된다

### BE-5. 프로모션 상태 전이 API (FR-3, FR-4)
- **선행 Task**: BE-4
- **작업 내용**: `PATCH /promotions/:id/approve`, `/reject`, `/cancel`, `PATCH /promotions/:id`(수정 후 승인). 상태 전이 규칙(`1-domain-definition.md` 6장)을 `promotions.service.js`의 순수 함수로 모아 구현하고, 승인/반려 시 reviewer_id를 기록한다.
- **완료 조건**
  - [ ] 승인 시 status가 `approved`로 바뀌고 reviewer_id가 채워진다
  - [ ] 반려사유 없이 반려 요청 시 400이 반환되고, 사유를 넣으면 `rejected`로 전이되며 reject_reason이 저장된다
  - [ ] 취소사유 없이 취소 요청 시 400이 반환되고, 사유를 넣으면 `cancelled`로 전이되며 cancel_reason이 저장된다
  - [ ] 협력사 계정으로 승인/반려/취소/수정 호출 시 403이 반환된다 (EC-01)
  - [ ] 허용되지 않은 상태 전이(예: `closed` → `approved`) 요청 시 409가 반환된다

### BE-6. 변경요청 API (FR-5)
- **선행 Task**: BE-5
- **작업 내용**: `POST /promotions/:id/change-requests`(협력사만, apply_status는 `pending`으로 생성, 대상 프로모션이 `approved` 이후면 `is_post_approval_change=true`), `GET /promotions/:id/change-requests`, `PATCH /change-requests/:id`(CJ프레시웨이만, `applied`/`rejected` 처리).
- **완료 조건**
  - [ ] 협력사가 변경요청 등록 시 apply_status가 `pending`으로 저장된다
  - [ ] 승인됨/진행중 상태의 프로모션에 대한 요청은 `is_post_approval_change=true`로 저장된다 (EC-03)
  - [ ] 변경요청 등록 후에도 프로모션 status는 `approved`를 유지한다 (검토중으로 되돌아가지 않음)
  - [ ] CJ프레시웨이가 처리 시 apply_status가 `applied`/`rejected`로 갱신되고, 협력사가 처리 시도 시 403이 반환된다

### BE-7. 상태 전이 단위 테스트
- **선행 Task**: BE-6
- **작업 내용**: `5-project-principle.md` 4장 원칙에 따라 상태 전이 규칙과 EC-03 판단 로직에만 단위 테스트를 작성한다. 프레임워크 추가 없이 `node:test` + `assert` 사용. CRUD성 API는 테스트하지 않는다.
- **완료 조건**
  - [ ] 정상 전이 경로(proposed→in_review→approved→active→closed, proposed→rejected→proposed)가 통과한다
  - [ ] 금지된 전이(예: closed→approved)가 거부되는 케이스가 테스트된다
  - [ ] `is_post_approval_change` 판단 함수가 승인 전/후 케이스 모두에서 검증된다
  - [ ] `node --test`로 전체 테스트가 통과한다

### BE-8. (P1) 재오픈 및 기간 중복 경고 (FR-8, FR-9)
- **선행 Task**: BE-7
- **작업 내용**: `PATCH /promotions/:id/reopen`(CJ프레시웨이만, `closed`/`cancelled` → `in_review`), 그리고 등록·승인 시점의 기간 중복 검사(동일 품목 + 동일 공급사 기준, 1일 이상 겹치면 경고 응답에 포함하되 차단하지 않음).
- **완료 조건**
  - [ ] `closed`/`cancelled` 프로모션만 `in_review`로 재오픈되고, 그 외 상태는 409가 반환된다 (EC-02)
  - [ ] 협력사 계정으로 재오픈 시도 시 403이 반환된다
  - [ ] 동일 품목·동일 공급사로 기간이 1일 이상 겹치면 응답에 경고 정보가 포함되되 등록 자체는 성공한다 (EC-05)

---

## 3. 프론트엔드

### FE-1. 프로젝트 셋업 및 API 클라이언트
- **선행 Task**: 없음 (BE와 병행 가능, 단 실제 통신 확인은 BE-2 이후)
- **작업 내용**: React 19 프로젝트를 만들고 `5-project-principle.md` 6장 구조(`src/api`, `src/stores`, `src/features`, `src/components`, `src/routes`)를 잡는다. Zustand `authStore`(access token, 로그인 사용자), TanStack Query Provider, `api/client.js`(baseURL, Authorization 헤더 자동 첨부, 401 시 `/auth/refresh` 호출 후 원요청 1회 재시도), 라우터 설정.
- **완료 조건**
  - [ ] 개발 서버가 기동되고 라우팅으로 화면 전환이 된다
  - [ ] API 클라이언트가 access token을 Authorization 헤더에 자동으로 붙인다
  - [ ] 401 응답 시 refresh를 1회 호출하고 원요청을 재시도한다 (무한 재시도 없음)
  - [ ] 미인증 상태로 보호된 경로 접근 시 로그인 화면으로 리다이렉트된다

### FE-2. 로그인 / 회원가입 화면 (FR-1)
- **선행 Task**: FE-1, BE-2
- **작업 내용**: `7-wireframe.md` 1~2번 화면을 구현한다. 역할(협력사/CJ프레시웨이) 라디오 선택이 있는 회원가입 폼, 로그인 폼, 오류 메시지 표시.
- **완료 조건**
  - [ ] 회원가입 성공 시 로그인 화면으로 이동한다
  - [ ] 로그인 성공 시 access token이 Zustand에 저장되고 프로모션 목록으로 이동한다
  - [ ] 로그인 실패 시 폼 상단에 오류 메시지가 표시된다 (EC-06)
  - [ ] 새로고침 시 refresh 쿠키로 세션이 복구되거나 로그인 화면으로 이동한다 (메모리 토큰 소실 처리)

### FE-3. 프로모션 목록 화면 (FR-2 목록, FR-7 진입점)
- **선행 Task**: FE-2, BE-4
- **작업 내용**: `7-wireframe.md` 3번 화면을 구현한다. 상태 필터 드롭다운, 목록 테이블(제목/기간/상태/제안자), 협력사에게만 보이는 `[+ 프로모션 등록]` 버튼, 행 클릭 시 상세 이동. TanStack Query 훅 `usePromotions`로 조회.
- **완료 조건**
  - [ ] 협력사 로그인 시 본인 프로모션만, CJ프레시웨이 로그인 시 전체가 표시된다
  - [ ] 상태 필터 변경 시 목록이 재조회된다
  - [ ] `[+ 프로모션 등록]` 버튼이 협력사에게만 노출된다
  - [ ] 행 클릭 시 해당 프로모션 상세로 이동한다

### FE-4. 프로모션 등록 화면 (FR-2)
- **선행 Task**: FE-3, BE-4
- **작업 내용**: `7-wireframe.md` 4번 화면을 구현한다. 기간(시작일/종료일), 품목명·규격 입력 후 `[+ 추가]`로 목록에 쌓는 UI, 조건 텍스트 입력, 필수값 검증 메시지.
- **완료 조건**
  - [ ] 품목을 추가/삭제할 수 있고 최소 1개 없이는 제출되지 않는다
  - [ ] 필수값 누락 시 폼 내 오류 메시지가 표시된다
  - [ ] 등록 성공 시 목록 화면으로 이동하고 새 프로모션이 '제안됨'으로 보인다

### FE-5. 프로모션 상세 화면 (FR-3, FR-4)
- **선행 Task**: FE-4, BE-5
- **작업 내용**: `7-wireframe.md` 5번 화면 상단부를 구현한다. 상태/제안자/기간/품목/조건 표시, 역할·상태에 따라 노출되는 액션 버튼(승인/수정 후 승인/반려/취소), 반려·취소 시 사유 입력 모달, "수정 후 승인"은 상단 필드 인라인 편집 모드.
- **완료 조건**
  - [ ] 협력사에게는 액션 버튼 대신 "직접 수정 불가 - 변경요청 안내" 문구가 표시된다 (EC-01)
  - [ ] CJ프레시웨이에게 현재 상태에서 가능한 버튼만 활성화되어 보인다
  - [ ] 반려/취소 시 사유를 입력해야 확정되고, 처리 후 상태 배지가 즉시 갱신된다
  - [ ] 수정 후 승인 시 변경된 기간/품목/조건이 반영된 채로 '승인됨'이 된다

### FE-6. 변경요청 영역 (FR-5)
- **선행 Task**: FE-5, BE-6
- **작업 내용**: `7-wireframe.md` 5번 화면 하단부를 구현한다. 협력사용 변경요청 등록 폼, 요청 이력 목록(요청자/일시/내용/반영여부, 승인후변경 표시), CJ프레시웨이용 `[반영완료]`/`[반영거부]` 버튼.
- **완료 조건**
  - [ ] 협력사가 변경요청 등록 시 이력 최상단에 '대기'로 추가된다
  - [ ] 승인 이후 등록된 요청에 "승인후변경" 표시가 보인다
  - [ ] CJ프레시웨이가 반영완료/반영거부 처리 시 해당 항목의 반영여부가 갱신된다
  - [ ] 협력사에게는 반영완료/반영거부 버튼이 보이지 않는다

### FE-7. 캘린더 화면 (FR-7)
- **선행 Task**: FE-6, BE-4
- **작업 내용**: `7-wireframe.md` 6번 화면을 구현한다. 월/주/일 뷰 전환 탭, 이전/다음 기간 이동, 기간과 겹치는 프로모션 막대 표시, 클릭 시 상세 이동. 외부 캘린더 라이브러리 도입은 선택 사항이되 직접 구현이 길어지면 라이브러리를 쓴다.
- **완료 조건**
  - [ ] 월 뷰에서 해당 월과 겹치는 진행 중·예정 프로모션이 표시된다
  - [ ] 월/주/일 탭 전환 시 조회 범위가 바뀌어 재조회된다
  - [ ] 프로모션 클릭 시 상세 화면으로 이동한다

### FE-8. 반응형 레이아웃 적용
- **선행 Task**: FE-7
- **작업 내용**: `7-wireframe.md` 0장의 브레이크포인트 전략(`@media (max-width: 767px)` 1개)을 적용한다. 목록 표→카드, 등록 폼 가로 배치→세로 스택, 상세 액션 버튼 세로 배치, 캘린더 그리드→날짜별 리스트. 컴포넌트를 분기하지 않고 CSS로만 전환한다.
- **완료 조건**
  - [ ] 375px 폭에서 모든 화면이 가로 스크롤 없이 표시된다
  - [ ] 목록이 카드형으로, 캘린더가 날짜별 리스트로 전환된다
  - [ ] 1024px 이상에서 기존 데스크톱 레이아웃이 그대로 유지된다
  - [ ] 브레이크포인트별 별도 컴포넌트 분기 없이 CSS만으로 처리되었다

---

## 4. 일정 배분 (3일 / 1인)

| Day | Task |
|---|---|
| Day 1 | DB-1, DB-2, BE-1, BE-2, BE-3, BE-4, FE-1, FE-2 |
| Day 2 | BE-5, BE-6, BE-7, FE-3, FE-4, FE-5, FE-6 |
| Day 3 | FE-7, FE-8, 통합 점검(`4-user-scenario.md` 시나리오 1~6 수동 확인), 여유 시 BE-8 |

- Day 1의 인증(BE-2·BE-3·FE-1의 refresh 인터셉터)이 가장 큰 리스크 구간이다. 여기서 지연되면 BE-8(P1)을 먼저 포기한다.
- Day 3의 통합 점검은 자동화 없이 `4-user-scenario.md`의 시나리오 6개를 수동으로 훑는 것으로 대체한다 (`5-project-principle.md` 4장).
