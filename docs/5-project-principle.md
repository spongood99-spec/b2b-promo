# 프로젝트 구조 설계 원칙 - CJ프레시웨이 프로모션 협업 앱

> 기준 문서: `1-domain-definition.md`(v1.4), `2-prd.md`(v1.0), `2-usecase.md`, `4-user-scenario.md`
> 전제: 3일 / 1인 개발 MVP. 이 문서의 모든 규칙은 "지금 당장 필요한 것만" 기준으로 작성했다.

## 1. 최상위 원칙 (모든 스택 공통)

1. **오버엔지니어링 금지 (YAGNI)** — 지금 필요 없는 추상화·설정값·확장 포인트는 만들지 않는다. "나중에 필요할 수도 있으니" 는 금지 사유다.
2. **실용성 우선** — 정답보다 3일 안에 동작하는 코드가 우선. 레이어를 나누는 이유는 "이해하기 쉬워서"이지 "정석이라서"가 아니다.
3. **관심사 분리는 최소 단위로** — 라우트/컨트롤러/서비스, UI/상태/서버상태 처럼 문서 6~7장에 정의한 딱 그만큼만 나눈다. 그 이상 세분화(예: repository 계층, usecase 계층, DTO 변환 계층 등) 하지 않는다.
4. **단일 진실 원천(SSOT)** — 서버 상태(프로모션, 변경요청 등)는 TanStack Query 캐시가 유일한 소스다. 같은 데이터를 Zustand에 중복 저장하지 않는다. DB에서는 각 값이 한 테이블/한 컬럼에만 존재한다(정규화, 파생 데이터 저장 금지).
5. **일관된 에러 처리** — 백엔드는 모든 에러를 `{ error: { code, message } }` 형태의 단일 포맷으로 응답하고, HTTP 상태코드로 종류를 구분한다(400/401/403/404/409/500). 프론트는 TanStack Query의 `onError`/`isError`에서 이 포맷 하나만 처리하면 된다. 커스텀 에러 클래스 계층을 여러 단계로 만들지 않는다.
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

- 3일 MVP 규모에서 e2e/통합 테스트 자동화는 **범위 밖**이다. 수동으로 시나리오(4-user-scenario.md 1~6)를 훑어보는 것으로 대체한다.
- 단위 테스트는 **상태 전이 로직에만** 작성한다. 대상: 프로모션 상태 전이 규칙(제안됨→검토중→승인됨/반려됨, 취소, 재오픈), EC-03(승인후변경 판단), EC-05(기간 중복 판단) 같이 분기가 있고 틀리면 데이터가 잘못되는 순수 함수 위주.
- CRUD성 컨트롤러/라우트, 단순 조회 API에는 테스트를 만들지 않는다.
- 커버리지 목표 수치를 정하지 않는다(80% 등 강제하지 않음). "핵심 로직에 대한 테스트가 있는가"만 확인한다.
- 테스트 프레임워크는 별도 도입 없이, 이미 Node.js에 있는 `node:test` + `assert`로 충분하면 그것을 쓴다(추가 의존성 최소화).

## 5. 설정 / 보안 / 운영 원칙

- **환경변수**: `.env` 파일 하나로 관리(`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PORT` 등). 환경별 분리(dev/staging/prod)는 하지 않는다. `.env`는 `.gitignore`에 포함하고 `.env.example`만 커밋한다.
- **JWT**: access token은 짧은 만료(예: 15분), refresh token은 김(예: 7일). access는 클라이언트 메모리(Zustand)에만, refresh는 HttpOnly Secure 쿠키. 서버는 서명/만료만 검증하며 블랙리스트·회전 이력은 관리하지 않는다(PRD 5장과 동일, MVP 범위 밖).
- **DB 접속정보**: `DATABASE_URL` 환경변수 하나로 pg Pool을 생성한다. 커넥션 풀 설정도 기본값 위주로, 별도 튜닝은 하지 않는다.
- **로깅**: `console.log`/`console.error` 수준의 최소 로깅으로 충분하다. 요청 진입 시 method+path, 에러 발생 시 스택트레이스 정도만 남긴다. 구조화 로깅(JSON), 분산 트레이싱, 로그 수집 인프라는 도입하지 않는다.
- **배포**: 단일 서버(Node.js 프로세스 하나 + PostgreSQL 하나) 전제. 이중화, 로드밸런서, 오토스케일링, 캐시 레이어(Redis 등)는 만들지 않는다.
- **비밀번호**: bcrypt 등으로 해시 저장. 그 외 계정 잠금, 2FA 등은 범위 밖(EC-06).

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
        ChangeRequestForm.jsx
        useChangeRequests.js
      calendar/
        CalendarPage.jsx
        useCalendarPromotions.js
    components/          # 여러 feature에서 재사용하는 공통 UI (Button, Modal 등)
    routes/              # 라우팅 설정 (React Router 등)
      AppRouter.jsx
    App.jsx
    main.jsx
```
- `features` 아래는 도메인 정의서의 엔티티/유스케이스 단위로 나눈다(auth, promotions, changeRequests, calendar). 각 feature 폴더 안에 화면 컴포넌트 + TanStack Query 훅을 같이 둔다(별도 `hooks/`, `services/` 하위 폴더로 더 쪼개지 않는다).
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
