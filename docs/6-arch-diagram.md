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
