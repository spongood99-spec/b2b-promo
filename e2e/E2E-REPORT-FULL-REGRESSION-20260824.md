# 전체 기능 강화 회귀 테스트(Full Regression E2E) — 2026-08-24

- **범위**: FR-1~FR-13 전체, 13개 프로모션 부가속성, Critical/High/Medium/Low 하드닝 전체(TOCTOU 가드, IDOR 방지, rate limit, 계정별 캐시 격리, 알림, JWT 고정, a11y).
- **환경**: 프로덕션(`https://cjk-007-fe.vercel.app` / `https://cjk-007-be.vercel.app`), Supabase Postgres. 로컬 dev 서버는 사용하지 않음.
- **방법**: 실제 API 호출(fetch, 브라우저 컨텍스트) + Playwright UI 조작으로 실행 확인. 코드 리딩으로 "구현되어 있으니 통과"라 추정한 항목은 없음.

## 1. 결과 요약

| 시나리오 | 결과 |
|---|---|
| 회원가입/로그인/로그아웃(협력사·CJ) | ✅ Pass |
| 프로모션 등록 — 13개 부가속성 전체 포함 | ✅ Pass (UI 경로) |
| 프로모션 등록 — 일부 필드만(부분 등록) | ✅ Pass |
| 목록 조회 "조회" 버튼(수동 재조회) | ✅ Pass |
| 페이지네이션(관리자, `page`/`limit`) | ✅ Pass — `{items,total,page,limit}` 정상 |
| 캘린더 조회(`from`/`to`, 배열 응답) | ✅ Pass |
| 상세 조회 | ✅ Pass |
| 승인/반려/재제출(FR-12)/취소/재오픈 전체 상태 전이 | ✅ Pass |
| EC-01: 협력사의 취소/재오픈 시도 → 403 | ✅ Pass |
| 동시 승인/반려 레이스 컨디션 → `[200,409]` | ✅ Pass |
| 변경요청 등록(승인 후) | ✅ Pass |
| IDOR: 타사 프로모션에 변경요청 시도 → 403 | ✅ Pass |
| 알림(FR-13) — 목록, 빈 상태, Esc 닫기 | ✅ Pass |
| 비밀번호 변경(FR-11) — 성공/짧은 비밀번호 실패/재로그인 | ✅ Pass |
| 모달 접근성 — 포커스 이동/Esc/포커스 복원 | ✅ Pass (비밀번호 변경 모달로 확인) |
| 등록폼 13개 필드 label-input 연결 | ✅ Pass (`getByRole('textbox'/'spinbutton'/'combobox', {name})`로 전부 접근 가능) |
| Rate limit — `/auth/login` 25회 연속 | ✅ Pass — 10번째 요청부터 `429` |
| 숫자 필드 음수 검증(`moq: -5` 등) | ✅ Pass |

## 2. 발견 이슈

### ✅ (2026-08-24 추가 조사로 재현 실패 → 종결) 짧은 시간 내 다수의 API 호출을 연쇄 실행하면 일부 요청의 JSON 바디가 서버에 비어 있는 것처럼 처리된다고 보고되었던 건

- **원 보고**: 같은 브라우저 탭에서 `fetch`를 10회 이상 연속(순차)으로 보내면 일부 POST/PATCH가 "필수 항목이 누락되었습니다" 400을 반환한다고 보고됨(로그인 2회+회원가입+로그인 후 `POST /promotions` 케이스, `PATCH /auth/password` 케이스).
- **추가 조사(같은 날, 재현조건 좁히기)**: 아래 4가지 방식으로 재현을 시도했으나 전부 100% 성공(0/실패)했다.
  1. Node(`fetch`, `node --test` 아닌 순수 스크립트)로 순차 20회 `POST /promotions` — 20/20 성공
  2. Playwright 브라우저 컨텍스트에서 순차 20회 `POST /promotions` — 20/20 성공
  3. 원 보고의 정확한 시나리오(로그인 2회 → 회원가입 1회 → 로그인 1회 → 즉시 `POST /promotions`)를 브라우저에서 그대로 재현 — 성공(201)
  4. 브라우저에서 `Promise.all`로 실제 동시(비순차) 12회 `POST /promotions` — 12/12 성공
- **결론**: 애플리케이션(백엔드) 결함으로 재현되지 않았다. 원 보고는 원 테스트 하네스 자체의 결함(예: 로그인 응답 필드명을 `accessToken`으로 오독해 실제로는 `undefined` 토큰을 보내는 등의 스크립트 버그)일 가능성이 높은 것으로 결론짓고, 애플리케이션 버그로 취급하지 않는다. 코드 수정 없음. `docs/9-plan.md`의 "알려진 이슈" 항목도 "재현 실패로 종결"로 갱신함.

### ℹ️ (참고, 버그 아님) 품목 필드명은 `name`/`spec`이며 `item_name`/`item_code`가 아님

- 테스트 중 `items:[{item_name, item_code}]`로 잘못 보내 발견. 실제로는 `items:[{name, spec}]`가 맞는 스펙이며, 잘못된 필드명을 보내면 `name`이 없어 "필수 항목이 누락되었습니다" 400을 정상적으로 반환한다(자체 문서·swagger.json과 실제 동작 일치, 프론트 폼도 `name`/`spec`로 정확히 전송함을 등록폼 UI 테스트에서 확인). 문서 불일치는 없음 — 테스트 스크립트 작성 실수였다.

## 3. 새로 발견된 docs 불일치

- 없음. `docs/swagger.json`의 `PromotionExtraFields`(할인유형 등 enum 값 `정률할인/정액할인/사은품/1+1/기타`, `신제품출시/시즌행사/재고소진/단순할인/기타`)와 실제 백엔드 검증 로직이 정확히 일치함을 이번 테스트로 재확인. 페이지네이션 응답 스키마(`{items,total,page,limit}`), rate limit(429), 비밀번호 최소 8자, JWT HS256 고정 모두 문서와 코드가 일치.

## 4. 테스트 데이터 정리

생성했던 테스트 프로모션 15건, 관련 알림 45건, 품목 15건, 임시 협력사 계정 5건(`e2e-partnerb-*`, `e2e-isolate-*`)을 프로덕션 DB에서 삭제했다. `test-partner@example.com`/`test-admin@example.com`은 상시 테스트 계정으로 유지. Rate limit 검증으로 소진된 `/auth/login` 요청 한도(15분/IP)는 시간이 지나면 자동 해제되므로 별도 조치 불필요. `.playwright-mcp` 스크래치 폴더 삭제 완료.
