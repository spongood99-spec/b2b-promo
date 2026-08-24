# 출하검사(Shipping Inspection) / 통합테스트 리포트 — 2026-08-21

- **범위**: 지금까지 구축된 CJ프레시웨이 프로모션 협업 앱 전체(backend/, frontend/)를 4개 관점(백엔드 코드/아키텍처, 프론트엔드 코드/UX, 보안, 테스트 커버리지)에서 독립적으로 병렬 검증한 뒤, 그중 Critical/High로 판정된 항목을 실제로 수정·검증했다.
- **방법**: 4개 서브에이전트가 각자 읽기 전용으로 코드베이스를 분석해 우선순위별 발견사항을 보고 → 사용자가 "Critical + High만 진행"을 선택 → 수정 → 백엔드 회귀 테스트 → 프로덕션 Playwright 검증 → 테스트 데이터 정리.

## 1. 발견사항 종합 (중복 제거)

| 우선순위 | 항목 | 처리 |
|---|---|---|
| Critical | 상태 전이 UPDATE 전체에 TOCTOU 레이스 컨디션(동시 승인/반려 시 데이터 뒤섞임 가능) | ✅ 수정 |
| Critical | 변경요청 등록(`createChangeRequest`) 소유권 검증 누락 — IDOR | ✅ 수정 |
| High | 알림 발송 실패가 이미 커밋된 본 작업까지 500으로 만듦 | ✅ 수정 |
| High | `/auth/login`, `/auth/signup`에 rate limiting 없음 | ✅ 수정 |
| High | TanStack Query 캐시가 사용자별로 분리 안 됨(계정 전환 시 데이터 유출) | ✅ 수정 |
| High | 등록폼/상세편집/13개 실무필드/변경요청 입력의 label-input 연결 누락 | ✅ 수정 |
| Medium | 회원가입 비밀번호 강도 검증 없음, 에러 핸들러 원본 메시지 노출, 필수 env var 미검증, refresh token 무효화/회전 없음, `POST /auth/logout` 부재, NotificationBell 로딩/에러/키보드 접근성, 모달 포커스 관리, 실무속성 숫자필드 범위검증 | ⏸ 보류(사용자가 이번 라운드는 Critical+High만 요청) |
| Low | EC-05 승인시점 테스트 공백, JWT algorithms 미고정, 알림 드롭다운 바깥클릭, 프론트 테스트 0건, 동시성 테스트 부재, 오늘 신규 기능 교차 통합테스트 부재 | ⏸ 보류 |

## 2. Critical/High 수정 내역

### 2.1 상태 전이 레이스 컨디션 (Critical)
`promotions.service.js`의 `approvePromotion`/`rejectPromotion`/`cancelPromotion`/`updateAndApprovePromotion`/`reopenPromotion`/`resubmitPromotion` — 기존에는 `SELECT`로 상태를 확인한 뒤 별도로 `UPDATE`를 실행해, 그 사이 다른 요청이 먼저 상태를 바꿔도 감지하지 못했다. 모든 UPDATE의 `WHERE`에 `AND status = ANY(허용상태목록)`을 추가하고, `rowCount === 0`이면 409(`다른 요청에 의해 프로모션 상태가 이미 변경되었습니다`)를 반환하도록 했다.

### 2.2 변경요청 등록 IDOR (Critical)
`changeRequests.service.js`의 `createChangeRequest`가 `promotionId`의 존재만 확인하고 소유권을 검증하지 않아, 협력사 A가 협력사 B의 프로모션 id로 변경요청을 등록(+CJ 전체 알림 발송까지)할 수 있었다. 프로모션 조회 시 `proposer_id`를 함께 가져와 `requesterId`와 비교, 불일치 시 403을 반환하도록 수정했다.

### 2.3 알림 발송 실패 격리 (High)
알림 insert가 이미 COMMIT된 본 트랜잭션(등록/승인/반려/재제출/변경요청) 뒤에 그대로 `await`되어, 알림 하나가 실패하면 이미 성공한 작업까지 500으로 응답했다. 모든 알림 호출에 `.catch(err => console.error(...))`를 붙여 격리했다.

### 2.4 인증 엔드포인트 rate limiting (High)
`/auth/login`, `/auth/signup`에 `express-rate-limit`(15분당 20회, IP 기준)을 추가했다. `node --test` 실행 시(`process.execArgv`에 `--test*` 플래그 존재)에는 자동으로 스킵되어 기존 테스트 스위트(수십 회의 signup/login 호출)에 영향이 없다.

### 2.5 계정 전환 캐시 유출 (High)
오늘 알림 기능에서 발견해 고친 캐시 유출 버그가 `usePromotions`/`usePromotion`/`useCalendarPromotions`/`useChangeRequests` 등 다른 훅에도 동일하게 존재했다. 훅마다 쿼리 키에 사용자 식별자를 넣는 대신, `authStore`의 `setAuth`(사용자가 실제로 바뀔 때만)와 `clearAuth`에서 TanStack Query 캐시 전체를 비우는 근본적인 방식으로 해결했다(액세스 토큰 조용한 갱신 시에는 캐시를 비우지 않아 정상적인 캐싱 이점은 유지).

### 2.6 label-input 연결 누락 (High)
`PromotionForm.jsx`, `PromotionDetailPage.jsx` 편집모드, `PromotionExtraFields.jsx`(13개 필드), `ChangeRequestSection.jsx`, 반려/취소 사유 모달 전체에 `htmlFor`/`id`/`aria-labelledby`를 추가했다.

## 3. 백엔드 회귀 테스트

`node --test` **83/83 통과** (기존 81건 + 신규 2건).

- 신규: "동시에 승인/반려 요청이 들어오면 한 쪽만 성공하고 나머지는 409가 반환된다" — `Promise.all`로 두 요청을 동시에 보내 `[200, 409]` 조합만 나오는지 검증(재실행해도 안정적으로 통과 확인)
- 신규: "다른 협력사의 프로모션에 변경요청을 등록하려 하면 403이 반환된다" — IDOR 방지 검증

## 4. 프로덕션 검증

| 항목 | 방법 | 결과 |
|---|---|---|
| label-input 연결 | Playwright `getByLabel()`로 등록폼 필수필드 3개 + 13개 실무필드 전부 채움(연결이 끊겨 있으면 예외 발생) | ✅ 전부 성공 |
| 계정 전환 캐시 유출 | 협력사 로그아웃 → CJ프레시웨이 로그인 직후(대기 없이) 목록 즉시 조회 | ✅ 이전 계정 데이터 노출 없음(빈 상태로 시작 후 정상 데이터로 갱신) |
| 레이스 컨디션 가드 | 실제 프로모션에 승인/반려를 `Promise.all`로 동시 호출 | ✅ `200`/`409` 하나씩, 데이터 뒤섞임 없음 |
| IDOR 방지 | 협력사 B 계정으로 협력사 A의 프로모션에 변경요청 시도 | ✅ 403 `FORBIDDEN` |
| rate limiting | `/auth/login`에 25회 연속 요청 | ✅ 17번째부터 `429` 반환 확인 |

**신규 버그**: 없음.

## 5. 테스트 데이터 정리

검증에 사용한 프로모션 1건, 임시 IDOR 검증용 협력사 계정 1건을 삭제했다. `test-partner@example.com`/`test-admin@example.com`은 README에 문서화된 상시 테스트 계정이라 유지했다. rate limit 검증으로 소진된 요청 한도(15분/IP)는 시간이 지나면 자동 해제되므로 별도 조치가 필요 없다.

## 6. 남은 항목 (Medium/Low, 이번 라운드 미처리)

다음 라운드에서 다룰 후보로, 우선순위·사유를 함께 남긴다.

- 회원가입 비밀번호 강도 검증 부재(변경 시엔 8자 강제 — 정책 불일치)
- 에러 핸들러가 처리 안 된 예외의 DB 원본 메시지를 그대로 노출
- 필수 env var 부팅 시 검증 없음(fail-fast 미적용)
- refresh token 무효화/회전 메커니즘 없음, `POST /auth/logout` 서버 엔드포인트 부재
- `NotificationBell` 로딩/에러 상태 미처리, 키보드로 알림 항목 열기 불가, 바깥 클릭으로 안 닫힘
- 모달(비밀번호 변경, 반려/취소 사유) 포커스 관리(열림 시 포커스 이동, Esc 닫기, 닫힘 시 포커스 복원) 없음
- 13개 실무속성 중 숫자 필드(moq/공급가능수량/리드타임/할인값) 음수·비정상값 검증 없음
- EC-05(기간중복경고) 승인시점 경로 테스트 공백, AND조건 분리검증 누락
- JWT `algorithms` 미고정
- 프론트엔드 테스트 0건, 동시성/경쟁조건 테스트 부재, 오늘 추가 기능(재제출/알림/실무속성) 간 교차 통합테스트 부재(수동 Playwright 검증만 존재, 자동 회귀 자산 아님)

## 7. Medium 항목 후속 조치 (2026-08-21)

위 6장에서 남겨둔 Medium 항목 7건을 추가로 처리했다(`9-plan.md` BE-14/FE-14 참고). Low 항목(EC-05 테스트 공백, JWT algorithms, 프론트 테스트 0건, 동시성/교차 통합테스트 부재)은 이번에도 보류했다.

**백엔드**: 회원가입 비밀번호 8자 강제, 에러 핸들러의 미처리 예외 메시지 은닉, 부팅 시 필수 env var 검증(fail-fast), `POST /auth/logout`(refresh 쿠키 삭제) 추가, 실무속성 숫자 필드(할인값/최소주문수량/공급가능수량/리드타임) 음수 검증. `node --test` **86/86 통과**(신규 3건: 짧은 비밀번호 400, 로그아웃 쿠키 삭제, 음수 실무필드 400).

**프론트엔드**: `NotificationBell` 로딩/에러 상태, 항목을 `button`으로 전환(키보드 접근), 바깥클릭/Esc로 닫기. 공통 `useModalA11y` 훅을 `ChangePasswordModal`·반려/취소 사유 모달에 적용(열림 시 포커스 이동, Esc 닫기, 닫힘 시 포커스 복원). 로그아웃 시 서버 `/auth/logout` 호출 추가.

**프로덕션 검증(간이)**:

| 항목 | 결과 |
|---|---|
| 8자 미만 비밀번호 회원가입 → 400 | ✅ |
| 비밀번호 변경 모달: 열림 시 첫 입력 포커스 / Esc 닫기 / 닫힘 시 트리거로 포커스 복원 | ✅ 3개 모두 확인 |
| 알림 드롭다운 바깥 클릭 시 닫힘 | ✅ |
| 최소주문수량 -5 입력 후 등록 시도 → 폼 오류만 표시, 등록 안 됨 | ✅ (`"최소주문수량은 0 이상의 숫자여야 합니다"`) |
| 로그아웃 클릭 시 `POST /auth/logout` 200 호출 확인 | ✅ (network 로그로 확인) |

신규 버그 없음. 이번 검증은 실제 데이터 생성 없이(모두 사전 검증 단계에서 막힘) 끝나 별도 정리가 필요 없었다.

## 8. Low 항목 후속 조치 (2026-08-21)

6장에서 마지막으로 남겨둔 Low 항목 4건을 전부 처리했다(`9-plan.md` BE-15/FE-15 참고). 이제 6장의 Critical~Low 전체 목록이 처리 완료됐다.

**백엔드**: `jwt.sign`/`jwt.verify`에 `HS256` 알고리즘 명시(라이브러리 기본값 의존 제거). EC-05(기간중복경고) 테스트를 승인 시점 경로까지 확장하고 "동일 회사 AND 동일 품목" 조건을 분리 검증(동일 회사·다른 품목, 다른 회사·동일 품목 각각 false인지)하는 테스트 추가. 재제출/알림/13개 실무속성이 한 흐름에서 서로 간섭 없이 동작하는지 확인하는 교차 통합테스트(`integration-cross-feature.test.js`) 추가 — 재제출 시 보낸 필드만 갱신, 등록→반려→재제출→승인 전체 흐름에서 알림 4종이 정확히 1건씩만 생성, 승인후변경(변경요청)과 실무속성이 서로 값을 침범하지 않음을 확인. `node --test` **91/91 통과**(신규 5건).

**프론트엔드**: 처음으로 자동화 테스트 도입. 새 의존성 없이 Node 내장 `node --test`로 돌리기 위해 `PromotionExtraFields.jsx`의 JSX 없는 순수 로직을 `promotionExtraFieldsUtils.js`로 분리하고 그 파일만 테스트(`extraFieldsToPayload`/`extraFieldsFromPromotion`의 null 변환, 숫자 캐스팅, undefined 방어). `authStore`처럼 extension-less relative import를 쓰는 파일은 Node 네이티브 ESM 로더가 해석하지 못해 이번 범위에서는 제외했다(번들러 인식 테스트 러너 도입은 별도 결정 필요). `npm test`(frontend) **4/4 통과**, `npm run build`도 리팩터링 이후 동일 결과(동작 변경 없는 순수 리팩터링).

**프로덕션 검증(간이)**: 로그인 → 발급된 access token의 헤더가 `{"alg":"HS256","typ":"JWT"}`인지 확인 → 그 토큰으로 보호된 엔드포인트(`GET /promotions`) 호출 시 200 확인. JWT 서명/검증에 알고리즘을 명시적으로 고정한 뒤에도 로그인·인증 흐름이 정상 동작함을 확인했다(별도 UI 변경이 없는 라운드라 Playwright 전체 시나리오는 생략, curl 기반 스모크 체크로 충분). 신규 버그 없음, 테스트 데이터 생성 없어 정리 불필요.
