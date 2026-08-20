# 기술 아키텍처 다이어그램

> 3일/1인 개발 MVP, 단일 서버 배포 전제. 실제 배포/실행 단위(React 클라이언트, Express 서버, PostgreSQL) 수준의 큰 흐름만 표현한다. 레이어 세부 구조(라우트/컨트롤러/서비스 등)는 `5-project-principle.md`를 참고.

## 1. 전체 구성도

```mermaid
flowchart LR
    User["사용자<br/>(협력사 / CJ프레시웨이)"]

    subgraph Client["React 19 SPA (반응형 웹)"]
        Zustand["Zustand<br/>(access token 등 클라이언트 상태)"]
        TanstackQuery["TanStack Query<br/>(프로모션/변경요청 서버 데이터)"]
    end

    Server["Express 서버<br/>(JWT 인증, 역할 기반 접근 제어,<br/>프로모션/변경요청 CRUD·상태 전이)"]

    DB[("PostgreSQL 17<br/>users / promotions / items /<br/>promotion_items / change_requests")]

    User --> Client
    TanstackQuery <-->|"REST API 호출<br/>(access token: Authorization 헤더,<br/>refresh token: HttpOnly Secure 쿠키)"| Server
    Zustand -.->|access token 제공| TanstackQuery
    Server <-->|pg| DB
```

## 2. 인증 흐름 (access/refresh token)

```mermaid
sequenceDiagram
    participant C as React SPA
    participant S as Express 서버
    participant DB as PostgreSQL

    C->>S: POST /auth/login (이메일/비밀번호)
    S->>DB: 사용자 조회 및 비밀번호 검증
    DB-->>S: 사용자 정보
    S-->>C: access token(응답 바디) + refresh token(HttpOnly Secure 쿠키)
    Note over C: access token은 Zustand(메모리)에 저장

    C->>S: API 요청 (Authorization: Bearer access token)
    S-->>C: 정상 응답

    C->>S: API 요청 (access token 만료 → 401)
    C->>S: POST /auth/refresh (refresh token 쿠키 자동 전송)
    S-->>C: 새 access token 재발급
    C->>S: 원래 요청 재시도
```

## 3. 프론트엔드 컴포넌트 구조

> `5-project-principle.md` 6장의 디렉토리 구조를 페이지/컴포넌트 관계로 표현한 것. 각 feature 화면이 어떤 훅(TanStack Query)과 공통 컴포넌트를 쓰는지만 보여준다.

```mermaid
flowchart TD
    App["App.jsx<br/>(AppRouter, ProtectedRoute로 보호된 경로 가드)"]

    App --> LoginPage["LoginPage / SignupPage<br/>(features/auth)"]
    App --> PromotionListPage["PromotionListPage<br/>(features/promotions)"]
    App --> PromotionForm["PromotionForm<br/>(features/promotions, /promotions/new 독립 라우트)"]
    App --> PromotionDetailPage["PromotionDetailPage<br/>(features/promotions)"]
    App --> CalendarPage["CalendarPage<br/>(features/calendar)"]

    LoginPage -.->|useAuth| AuthStore["authStore<br/>(stores, Zustand)"]

    PromotionListPage -.->|usePromotions| Common["공통 컴포넌트<br/>(components: AppHeader, StatusBadge, ProtectedRoute)"]
    PromotionDetailPage --> ChangeRequestSection["ChangeRequestSection<br/>(features/changeRequests, 상세 화면 하단부 섹션)"]
    PromotionDetailPage -.->|usePromotionMutations| Common
    ChangeRequestSection -.->|useChangeRequests| Common

    CalendarPage -.->|useCalendarPromotions| Common
```

> 참고: `PromotionForm`은 `PromotionDetailPage`의 자식 컴포넌트가 아니라 `/promotions/new`로 라우팅되는 별도 화면이다. `PromotionDetailPage`의 "수정 후 승인" 인라인 편집 모드는 `PromotionForm`을 재사용하지 않고 자체적으로 구현되어 있다(품목 추가/삭제 UI가 두 파일에 각각 존재).
