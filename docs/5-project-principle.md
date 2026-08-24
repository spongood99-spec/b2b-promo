# 프로젝트 구조 설계 원칙 - CJ프레시웨이 프로모션 협업 앱

> 기준 문서: `1-domain-definition.md`(v1.4), `2-prd.md`(v1.0), `2-usecase.md`, `4-user-scenario.md`
> 전제: 3일 / 1인 개발 MVP. 이 문서의 모든 규칙은 "지금 당장 필요한 것만" 기준으로 작성했다.

## 1. 최상위 원칙 (모든 스택 공통)

1. **오버엔지니어링 금지 (YAGNI)** — 지금 필요 없는 추상화·설정값·확장 포인트는 만들지 않는다. "나중에 필요할 수도 있으니" 는 금지 사유다.
2. **실용성 우선** — 정답보다 3일 안에 동작하는 코드가 우선. 레이어를 나누는 이유는 "이해하기 쉬워서"이지 "정석이라서"가 아니다.
3. **관심사 분리는 최소 단위로** — 라우트/컨트롤러/서비스, UI/상태/서버상태 처럼 문서 6~7장에 정의한 딱 그만큼만 나눈다. 그 이상 세분화(예: repository 계층, usecase 계층, DTO 변환 계층 등) 하지 않는다.
4. **단일 진실 원천(SSOT)** — 서버 상태(프로모션, 변경요청 등)는 TanStack Query 캐시가 유일한 소스다. 같은 데이터를 Zustand에 중복 저장하지 않는다. DB에서는 각 값이 한 테이블/한 컬럼에만 존재한다(정규화, 파생 데이터 저장 금지).
5. **일관된 에러 처리** — 백엔드는 모든 에러를 `{ error: { code, message } }` 형태의 단일 포맷으로 응답하고, HTTP 상태코드로 종류를 구분한다(400/401/403/404/409/429/500). 프론트는 TanStack Query의 `onError`/`isError`에서 이 포맷 하나만 처리하면 된다. 커스텀 에러 클래스 계층을 여러 단계로 만들지 않는다. 단, 메시지 노출 범위는 구분한다 — 서비스 계층에서 명시적으로 `err.status`를 지정해 던진 에러(검증 실패, 권한 없음 등)는 `code`/`message`를 그대로 응답하고, `err.status`가 없는(처리되지 않은) 예외는 DB 원본 에러코드/메시지 등 내부 구조가 노출될 수 있어 `code`도 `message`도 고정값(`INTERNAL_ERROR`)으로 대체하며 상세는 서버 로그에만 남긴다(`middlewares/errorHandler.js`, 2026-08-21, 2026-08-24에 `code` 필드도 가리도록 보강 — 그전에는 DB 원본 에러코드가 그대로 노출되고 있었다). 예외적으로 잘못된 형식의 id(uuid 아님, PostgreSQL `22P02`) 하나는 클라이언트 실수이므로 400/`VALIDATION_ERROR`로 분류한다. 아울러 프로모션 관련 서비스(`promotions.service.js`)는 날짜 순서(종료일 ≥ 시작일)·정수 컬럼 범위·문자열 길이·품목 개수(최대 50)·품목명 공백 여부를 DB에 보내기 전에 애플리케이션 레벨에서 먼저 검증한다(2026-08-24) — DB 제약 위반이 그대로 500으로 새는 것을 막기 위함이며, 검증 규칙은 `docs/8-schema.sql`의 컬럼 타입/CHECK 제약과 반드시 일치시킨다.
6. **도메인 용어를 코드 전체에서 그대로 쓴다** — 새 용어를 만들거나 의역하지 않는다(3장 참고).
7. **미리 만들지 않는다** — 인증/권한, 상태 전이(도메인 정의서 6장)처럼 지금 요구된 로직만 구현한다. FR-8/FR-9(P1)은 시간이 남을 때만 붙이는 확장이지, 처음부터 자리를 비워두지 않는다.

## 2. 의존성 / 레이어 원칙

### 프론트엔드
```
UI (컴포넌트/페이지)
   → 전역 상태 (Zustand: access token 등 클라이언트 전용 상태만)
   → 서버 상태 (TanStack Query: 프로모션/변경요청 등 서버 데이터 fetch/mutate)
   → API 클라이언트 (fetch 래퍼: baseURL, 인증 헤더, 401 시 refresh 재시도)
```
- 의존 방향은 위→아래 단방향. 컴포넌트가 API 클라이언트를 직접 호출하지 않고 반드시 TanStack Query 훅(`usePromotions`, `useApprovePromotion` 등)을 통한다.
- Zustand에는 **서버 데이터를 넣지 않는다.** access token, 로그인 사용자 정보(role 등 최소한) 정도만 둔다.
- 하위 레이어(API 클라이언트)가 상위 레이어(컴포넌트, 상태)를 import하는 역방향 의존은 금지.
- **접근성 공통 컨벤션** (2026-08-24, 전체 회귀 테스트에서 정리): 폼 에러(`.form-error`)는 항상 `role="alert"`를 붙여 스크린리더가 자동으로 안내하게 한다. 모달은 `useModalA11y`(포커스 이동, Esc 닫기, Tab 순환 트랩, 닫힐 때 트리거로 포커스 복원)를 재사용하고 새로 만들지 않는다. 열림/닫힘형 드롭다운(예: `NotificationBell`)도 Esc/바깥클릭으로 닫힐 때 트리거 요소로 포커스를 되돌린다. 상태/색상 배지는 텍스트 자체를 색으로 쓰지 않고 고정된 짙은 텍스트 색 + 옅은 배경 톤으로 표현해 WCAG AA(4.5:1)를 항상 만족시킨다(`StatusBadge` 참고). 이미 인증된 사용자가 `/login`처럼 비인증 전용 라우트에 접근하면 리다이렉트한다.

### 백엔드
```
라우트 (routes) — URL과 HTTP 메서드만 정의, 컨트롤러 연결
   → 컨트롤러 (controllers) — req/res 파싱, 입력 검증 호출, 서비스 호출, 응답 포맷
   → 서비스 (services) — 비즈니스 로직, 상태 전이 규칙(6장), 권한 체크
   → DB 접근 (db) — pg 쿼리 실행
```
- 라우트는 얇게, 로직을 담지 않는다. 컨트롤러도 비즈니스 규칙을 담지 않고 서비스에 위임한다.
- 서비스는 pg 커넥션 풀을 직접 들고 있는 db 모듈을 호출하되, ORM/쿼리빌더 등 추가 레이어는 도입하지 않는다(pg로 충분).
- 역방향 의존(서비스가 라우트를 참조하는 등) 금지. 테이블 4~5개 규모이므로 repository 패턴 같은 별도 계층은 만들지 않고 서비스에서 바로 SQL을 호출한다.

## 3. 코드 / 네이밍 원칙

### 도메인 용어 ↔ 코드 식별자 매핑
| 한국어 도메인 용어 | 코드 식별자(영어) |
|---|---|
| 사용자 | User / `users` |
| 프로모션 | Promotion / `promotions` |
| 대상 품목 | Item / `items` (연결 테이블 `promotion_items`) |
| 변경요청 | ChangeRequest / `change_requests` |
| 제안됨/검토중/승인됨/반려됨/진행중/종료/취소됨 | `proposed`/`in_review`/`approved`/`rejected`/`active`/`closed`/`cancelled` (status enum 값) |
| 반영여부(대기/반영완료/반영거부) | `pending`/`applied`/`rejected` |

- 도메인 용어는 항상 위 표대로 영어로 번역해서 쓴다. 새로운 이름을 만들지 않는다(예: Promotion을 "Campaign"이라 부르지 않는다).
- UI에 노출되는 라벨(사용자에게 보이는 문자열)은 한국어 그대로, 코드 식별자(변수/함수/테이블/컬럼/enum 값)는 영어.

### 파일/함수 네이밍
- 백엔드: 파일은 소문자 케밥 또는 단수 명사 그대로. 예: `promotions.routes.js`, `promotions.controller.js`, `promotions.service.js`, `db/pool.js`.
- 프론트엔드: 컴포넌트 파일은 PascalCase(`PromotionForm.jsx`), 훅/유틸은 camelCase(`usePromotions.js`, `formatDate.js`).
- 함수명은 동사+명사(`getPromotionById`, `approvePromotion`, `createChangeRequest`). 상태 전이 함수는 도메인 상태값과 동일한 이름을 쓴다(`rejectPromotion`, `cancelPromotion`, `reopenPromotion`).
- 변수명은 도메인 용어의 영어 매핑을 그대로 사용(`status`, `rejectReason`, `cancelReason`, `isPostApprovalChange`).

## 4. 테스트 / 품질 원칙

- 브라우저 기반 e2e 자동화(CI에 편입되어 반복 실행되는 스위트)는 여전히 **범위 밖**이다. 실제 배포본 확인은 수동으로 시나리오(4-user-scenario.md 1~6)를 훑거나(2026-08-21 `e2e/E2E-REPORT.md` 등), Playwright MCP로 브라우저를 구동해 1회성으로 점검하는 방식을 쓴다.
- 다만 API 레벨 통합테스트(`node:test`로 실제 서버를 띄워 여러 엔드포인트를 순서대로 호출하는 방식, 예: `scenarios-e2e.test.js`, `integration-cross-feature.test.js`)는 이미 폭넓게 쓰고 있고 계속 늘려간다 — 브라우저 없이 빠르게 돌 수 있어 위 "e2e 자동화 범위 밖" 원칙과 충돌하지 않는다.
- 단위/통합 테스트는 다음에 집중한다: 상태 전이 로직(제안됨→검토중→승인됨/반려됨, 취소, 재오픈, 재제출), EC-03(승인후변경 판단)·EC-05(기간 중복 판단) 같이 분기가 있고 틀리면 데이터가 잘못되는 로직, 그리고 오늘처럼 여러 기능이 한 흐름에서 서로 간섭하는지(재제출+알림+실무속성 등). 단순 조회 API 자체를 위한 CRUD 테스트는 굳이 추가하지 않되, 다른 목적의 통합테스트 안에서 자연스럽게 함께 검증되는 것은 무방하다.
- 커버리지 목표 수치를 정하지 않는다(80% 등 강제하지 않음). "핵심 로직에 대한 테스트가 있는가"만 확인한다.
- 테스트 프레임워크는 백엔드/프론트엔드 모두 별도 도입 없이 Node.js 내장 `node:test` + `assert`로 충분하면 그것을 쓴다(추가 의존성 최소화). 프론트엔드는 JSX가 섞인 파일을 Node 네이티브 ESM 로더가 못 읽으므로, 테스트하려는 순수 로직은 JSX 없는 파일로 분리해 그 파일만 테스트한다(`promotionExtraFieldsUtils.js` 참고). 컴포넌트 렌더링·훅 테스트가 필요해지면 그때 vitest 등 번들러 인식 러너 도입을 별도로 결정한다. 테스트 파일은 `*.test.js`로 이름 짓고 테스트 대상 파일과 같은 디렉토리에 둔다(백엔드/프론트엔드 공통 컨벤션).

## 5. 설정 / 보안 / 운영 원칙

- **환경변수**: `.env` 파일 하나로 관리(`DATABASE_URL`, `PORT`, `CORS_ORIGIN`, `NODE_ENV`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES` 등). 환경별 분리(dev/staging/prod)는 하지 않는다. `.env`는 `.gitignore`에 포함하고 `.env.example`만 커밋한다. 필수 환경변수(`DATABASE_URL`/`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`CORS_ORIGIN`) 중 하나라도 없으면 앱 부팅 시 즉시 종료한다(`app.js`, fail-fast, 2026-08-21) — 배포 실수를 첫 요청이 아니라 기동 시점에 드러내기 위함.
- **JWT**: access token은 짧은 만료(기본 15분, `JWT_ACCESS_EXPIRES`로 조정 가능), refresh token은 김(기본 7일, `JWT_REFRESH_EXPIRES`로 조정 가능). access는 클라이언트 메모리(Zustand)에만, refresh는 HttpOnly Secure 쿠키. 서버는 서명/만료만 검증하며 블랙리스트·회전 이력은 관리하지 않는다(PRD 5장과 동일, MVP 범위 밖). `sign`/`verify` 모두 알고리즘을 `HS256`으로 명시 고정한다(2026-08-21, 라이브러리 기본값에 암묵적으로 의존하지 않기 위함). access/refresh 토큰 payload에는 `type: 'access'`/`type: 'refresh'` 클레임을 넣고 각 검증 지점에서 타입을 확인한다(2026-08-24 — 두 시크릿이 운영에서 우연히 같은 값이더라도 한 토큰을 다른 용도로 재사용할 수 없도록 하는 방어책). `POST /auth/logout`(2026-08-21 추가)은 refresh_token 쿠키만 지우며, 이미 발급된 access token을 서버가 강제로 무효화하지는 않는다(짧은 만료로 대응). 쿠키를 지울 때는 로그인 시 심은 옵션(`sameSite`/`secure`/`httpOnly`/`path`)과 반드시 동일하게 `clearCookie`를 호출해야 한다 — 옵션이 다르면 브라우저가 다른 쿠키로 취급해 삭제 지시를 무시한다(2026-08-24, 운영에서 실제로 로그아웃이 세션을 무효화하지 못하는 버그로 발견되어 수정).
- **DB 접속정보**: `DATABASE_URL` 환경변수 하나로 pg Pool을 생성한다. 커넥션 풀 설정도 기본값 위주로, 별도 튜닝은 하지 않는다.
- **로깅**: `console.log`/`console.error` 수준의 최소 로깅으로 충분하다. 요청 진입 시 method+path, 에러 발생 시 스택트레이스 정도만 남긴다. 구조화 로깅(JSON), 분산 트레이싱, 로그 수집 인프라는 도입하지 않는다.
- **배포**: 최초 설계는 단일 서버(Node.js 프로세스 하나 + PostgreSQL 하나) 전제였으나, 실제 운영은 프론트/백엔드가 각각 별도 Vercel 프로젝트로 분리 배포되고 DB는 Supabase Postgres다(`6-arch-diagram.md` 참고). 이중화, 로드밸런서, 오토스케일링, 캐시 레이어(Redis 등)는 여전히 만들지 않는다.
- **비밀번호**: bcrypt로 해시 저장, 회원가입/변경 모두 8자 이상 강제(2026-08-21부터 회원가입도 동일 정책). 계정 단위 잠금, 2FA 등은 범위 밖(EC-06)이나, `/auth/login`·`/auth/signup`에는 IP 기준 rate limit(15분당 20회, 2026-08-21 추가)이 있어 무차별 대입에 대한 최소 방어선은 있다.
- **HTTP 보안 헤더**: `helmet`(2026-08-24 추가)로 `X-Content-Type-Options`/`X-Frame-Options`/HSTS 등 기본 방어 헤더를 붙인다. CSP는 개발 모드에서만 마운트되는 `/api-docs`(swagger-ui-express)의 인라인 스크립트와 충돌해 끈다 — API가 거의 전부 JSON을 응답하므로 CSP 부재의 실질 영향은 제한적이다. 첨부링크(`attachment_url`)는 `http(s)://`로 시작하는 값만 허용한다(2026-08-24, `javascript:` 등 스킴 주입 방지).

## 6. 프론트엔드 디렉토리 구조

```
frontend/
  src/
    api/                 # API 클라이언트 (fetch 래퍼, 401 인터셉트 + refresh 재시도)
      client.js
    stores/              # Zustand 전역 상태 (client-only 상태만)
      authStore.js        # access token, 로그인 사용자 정보
    features/            # 도메인 단위로 묶은 화면/훅
      auth/
        LoginPage.jsx
        SignupPage.jsx
        useAuth.js         # login/signup mutation
      promotions/
        PromotionListPage.jsx
        PromotionDetailPage.jsx
        PromotionForm.jsx
        usePromotions.js   # 목록/상세 query
        usePromotionMutations.js  # 등록/승인/반려/취소/수정 mutation
      changeRequests/
        ChangeRequestSection.jsx
        useChangeRequests.js
      calendar/
        CalendarPage.jsx
        useCalendarPromotions.js
      notifications/       # 2026-08-21 추가
        useNotifications.js
    components/          # 여러 feature에서 재사용하는 공통 UI (AppHeader, StatusBadge, ProtectedRoute,
                          # NotificationBell, ChangePasswordModal 등, 2026-08-21 추가분 포함)
    hooks/               # 2026-08-21 추가. 특정 feature 하나가 아니라 여러 feature/공통 컴포넌트가
                          # 함께 쓰는 순수 훅만 여기 둔다(예: useModalA11y — ChangePasswordModal과
                          # PromotionDetailPage 양쪽에서 사용)
      useModalA11y.js
    routes/              # 라우팅 설정 (React Router 등)
      AppRouter.jsx
    App.jsx
    main.jsx
```
- `features` 아래는 도메인 정의서의 엔티티/유스케이스 단위로 나눈다(auth, promotions, changeRequests, calendar, notifications). 각 feature 폴더 안에 화면 컴포넌트 + TanStack Query 훅을 같이 두고, 그 feature 하나만을 위한 하위 `hooks/`, `services/` 폴더로 더 쪼개지 않는다. 다만 하나의 feature에 속하지 않고 여러 feature/공통 컴포넌트가 함께 쓰는 훅은 최상위 `hooks/`에 둔다(위 `useModalA11y` 참고) — "쪼개지 않는다"는 feature 내부 세분화를 금지하는 규칙이며, 진짜 공유 훅을 위한 최상위 폴더 자체를 막는 규칙은 아니다.
- `stores/`는 authStore 하나면 충분하다. 프로모션/변경요청용 store를 따로 만들지 않는다(서버 상태이므로 TanStack Query가 담당).

## 7. 백엔드 디렉토리 구조

```
backend/
  src/
    db/
      pool.js              # pg Pool 생성 (DATABASE_URL 사용)
      migrations/           # SQL 마이그레이션 파일 (001_init.sql 등)
    middlewares/
      auth.js               # JWT 검증, req.user 주입
      requireRole.js        # 역할 기반 접근 제어 (협력사/CJ프레시웨이)
      errorHandler.js        # 공통 에러 응답 포맷
    routes/
      auth.routes.js
      promotions.routes.js
      changeRequests.routes.js
    controllers/
      auth.controller.js
      promotions.controller.js
      changeRequests.controller.js
    services/
      auth.service.js         # 회원가입/로그인/토큰 발급/재발급
      promotions.service.js   # 등록/조회/승인/반려/취소/재오픈/상태전이 규칙
      changeRequests.service.js
    app.js                  # express 앱 설정 (미들웨어 연결)
    server.js               # 서버 기동 (listen)
  .env.example
```
- 엔티티 4개(User/Promotion/Item/ChangeRequest)에 라우트/컨트롤러/서비스 파일이 각각 대응한다. Item은 별도 CRUD 화면이 없으므로(PRD FR-2 참고) 독립 라우트를 만들지 않고 `promotions.service.js` 안에서 함께 처리한다.
- 상태 전이 로직(제안됨→검토중→승인됨/반려됨, 취소, 재오픈, EC-03/EC-05 판단)은 모두 `promotions.service.js`에 순수 함수로 모아 두고, 여기에만 단위 테스트를 작성한다(4장 참고).
- repository/DAO/DTO 계층을 별도로 만들지 않는다. 서비스에서 `pool.query(...)`를 직접 호출한다.
