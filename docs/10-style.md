# UI 스타일 가이드 - CJ프레시웨이 프로모션 협업 앱

> 기준 문서: `5-project-principle.md`(구조/원칙), `7-wireframe.md`(화면 구성), `2-prd.md`(기능요구사항)
> 참고 이미지: 핸드백 커머스 목록(미니멀 카드+필터 탭), 반려동물 커뮤니티 홈(오렌지 포인트 컬러+아이콘 그리드+FAB), 1:1 채팅(오렌지 말풍선)
> 전제: React 19 반응형 웹, 데스크톱 우선(`7-wireframe.md` 0장 브레이크포인트 1개 전략을 그대로 따름). 채팅 화면은 도메인 정의서에서 채팅/메시징 기능이 명시적으로 제외되었으므로 **말풍선 UI 자체는 이 프로젝트에 적용하지 않고**, 색상·타이포그래피 참고용으로만 사용한다.

## 1. 참고 이미지에서 가져온 것 / 가져오지 않은 것

| 참고 이미지 | 가져온 것 | 가져오지 않은 것 |
|---|---|---|
| 핸드백 커머스 목록 | 여백이 넉넉한 미니멀 카드 그리드, 알약(pill) 형태 필터 탭, 굵은 가격/타이틀 대비 | 상품 이미지 중심 레이아웃(이 앱은 텍스트/데이터 중심이라 이미지 없음) |
| 반려동물 커뮤니티 홈 | 포인트 컬러(오렌지), 카드형 섹션 구분, FAB(플로팅 액션 버튼) | 아이콘 그리드 홈 화면 구조(이 앱은 목록/캘린더 중심이라 불필요), 하단 탭 내비게이션(데스크톱 우선이라 상단 내비 유지, 모바일에서도 화면 수가 적어 미적용) |
| 1:1 채팅 | 오렌지 발신 말풍선 대비 무채색 수신 말풍선의 색 대비 원리 → 상태 배지/버튼의 강조색 대비에 응용 | 말풍선 UI, 채팅 입력창 전체 (채팅 기능 자체가 스코프 아웃) |

이 앱은 패션 커머스도 채팅 앱도 아닌 **B2B 업무 도구**이므로, 참고 이미지의 "톤(미니멀·여백·알약형 필터·포인트 컬러 하나로 강조)"만 가져오고 화면 구조는 `7-wireframe.md`를 그대로 따른다.

---

## 2. 컬러 팔레트

포인트 컬러는 커뮤니티/채팅 참고 이미지의 오렌지 계열을 채택한다(CJ 계열 브랜드 톤과도 자연스럽게 어울림). 색상 수를 늘리지 않고, 상태 배지에는 채도를 낮춘 별도 팔레트를 쓴다.

```css
:root {
  /* 브랜드/포인트 */
  --color-primary: #ED6A2C;       /* 오렌지 - 주요 버튼, 활성 필터, 강조 링크 */
  --color-primary-hover: #D65A1F;
  --color-primary-soft: #FDEDE3;  /* 오렌지 배경 톤(선택된 배지, 강조 영역 배경) */

  /* 중립(핸드백 커머스 참고: 크림 배경 + 짙은 텍스트) */
  --color-bg: #FAF8F5;
  --color-surface: #FFFFFF;
  --color-border: #E5E1DB;
  --color-text: #1A1A1A;
  --color-text-muted: #6B6B6B;

  /* 상태 배지 (promotions.status 7종 매핑) */
  --status-proposed: #6B7280;    /* 제안됨 - 중립 회색 */
  --status-in_review: #ED6A2C;   /* 검토중 - 포인트 컬러 */
  --status-approved: #16A34A;    /* 승인됨 - 그린 */
  --status-rejected: #DC2626;    /* 반려됨 - 레드 */
  --status-active: #2563EB;      /* 진행중 - 블루 */
  --status-closed: #6B7280;      /* 종료 - 중립 회색 */
  --status-cancelled: #9CA3AF;   /* 취소됨 - 연회색 */
}
```

- 포인트 컬러(`--color-primary`)는 화면당 "가장 중요한 액션 1개"에만 쓴다(예: `[+ 프로모션 등록]`, 로그인 버튼). 상태 배지·보조 버튼에 남용하지 않는다.
- 배경은 순백 대신 살짝 크림톤(`--color-bg`)을 써서 카드(`--color-surface`)와의 구분을 명암 대비가 아닌 미묘한 톤 차이로 준다(핸드백 커머스 참고 이미지의 방식).

---

## 3. 타이포그래피

```css
:root {
  --font-sans: -apple-system, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;

  --text-xs: 12px;   /* 보조 정보(캘린더 날짜, 타임스탬프) */
  --text-sm: 14px;   /* 표 본문, 폼 라벨 */
  --text-base: 16px; /* 기본 본문 */
  --text-lg: 18px;   /* 카드 타이틀, 섹션 헤더 */
  --text-xl: 24px;   /* 페이지 타이틀 */

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-bold: 700; /* 가격/금액성 정보(조건 텍스트의 할인율 등)는 bold, 핸드백 커머스 참고 */
}
```

- 품목명·프로모션 조건처럼 "숫자/핵심 값"은 `--weight-bold`로 강조한다(참고 이미지의 가격 표기 방식).
- 상태 배지 텍스트는 `--text-xs` + `--weight-medium` + 대문자 없이 한글 그대로("제안됨", "승인됨" 등, 영문 대문자 라벨링은 국문 UI에 부자연스러우므로 미적용).

---

## 4. 레이아웃 & 여백

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-pill: 999px;  /* 필터 탭, 상태 배지 */
  --radius-card: 12px;   /* 카드, 모달 */
  --radius-input: 8px;   /* 입력 필드, 버튼 */

  --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06);
}
```

- 카드/테이블 행 사이 간격은 `--space-4` 이상으로 넉넉하게(참고 이미지의 "여백이 곧 구분선" 원칙). 데이터가 조밀한 B2B 툴이라도 구분선(border)보다 여백을 우선한다.
- 그림자는 `--shadow-card` 하나만 쓰고 depth를 여러 단계로 나누지 않는다(오버엔지니어링 금지).

---

## 5. 컴포넌트

### 5.1 필터 탭 (알약형, 핸드백 커머스 참고)

프로모션 목록의 "상태 필터"에 적용한다.

```
( 전체 )  ( 제안됨 )  ( 승인됨 )  ( 반려됨 )  ( 진행중 )
```

- 비활성: `background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text);`
- 활성: `background: var(--color-text); color: white;` (참고 이미지의 "Women" 탭처럼 활성 상태는 검정 배경 — 포인트 컬러는 버튼에 집중시키고 필터 활성은 중립 강조로 구분)
- `border-radius: var(--radius-pill)`, 높이 32~36px, 가로 스크롤 허용(모바일에서 탭이 넘칠 경우).

### 5.2 상태 배지 (알약형 + 색상 대응)

```
[제안됨]  [검토중]  [승인됨]  [반려됨]  [진행중]  [종료]  [취소됨]
```

- `border-radius: var(--radius-pill)`, `padding: 2px 10px`, `font-size: var(--text-xs)`, `font-weight: var(--weight-medium)`.
- 배경은 해당 상태색의 10% 톤(`color-mix(in srgb, var(--status-*) 12%, white)`), 텍스트는 상태색 그대로. 채팅 참고 이미지의 "발신(진한 오렌지)/수신(연한 회색)" 대비 원리를 색상 강도 차이로 응용.

### 5.3 카드 (모바일 목록/캘린더용)

`7-wireframe.md`의 모바일 브레이크포인트(768px 미만)에서 표 → 카드로 전환되는 지점에 적용.

- `background: var(--color-surface); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-4);`
- 카드 내부 1행: 제목(`--text-lg`, bold) + 상태 배지(우측 정렬)
- 카드 내부 2행: 기간/제안자 등 메타 정보(`--text-sm`, `--color-text-muted`)

### 5.4 버튼

- **Primary**: `background: var(--color-primary); color: white; border-radius: var(--radius-input);` — 화면당 1개 원칙(`[+ 프로모션 등록]`, `[로그인]`, `[가입하기]`, `[승인]`).
- **Secondary**: `background: transparent; border: 1px solid var(--color-border); color: var(--color-text);` — `[취소]`, `[반려]` 등 보조/파괴적 액션 트리거.
- **Danger 확정**(반려/취소 사유 입력 모달의 최종 확정 버튼): `background: var(--status-rejected);` — 되돌릴 수 없는 상태 전이임을 색으로 신호.
- 호버 시 8~10% 어둡게(`--color-primary-hover`처럼 각 색상별 hover 변형만 두고 트랜지션은 `120ms ease` 하나로 통일).

### 5.5 플로팅 액션 버튼(FAB) — 모바일 한정, 선택 적용

커뮤니티 참고 이미지의 우하단 오렌지 원형 FAB(연필 아이콘)는 모바일 폭(768px 미만)에서 "프로모션 등록" 진입점으로 선택 적용 가능하다. 단, `7-wireframe.md`는 이미 상단 `[+ 프로모션 등록]` 버튼으로 진입점을 정의했으므로 **FAB를 추가로 만들지 않고 기존 버튼을 그대로 쓴다**(같은 기능의 진입점을 두 곳에 만들지 않음 — 오버엔지니어링 금지).

### 5.6 폼 필드

- `border: 1px solid var(--color-border); border-radius: var(--radius-input); padding: var(--space-3);`
- 포커스 시 `border-color: var(--color-primary)` + `box-shadow: 0 0 0 3px var(--color-primary-soft)`.
- 오류 메시지는 필드 바로 아래 `--status-rejected` 색상, `--text-sm`.

---

## 6. 적용 매핑 (와이어프레임 화면 기준)

| 화면 (`7-wireframe.md`) | 적용 컴포넌트 |
|---|---|
| 로그인/회원가입 | 5.4 버튼(Primary), 5.6 폼 필드 |
| 프로모션 목록 | 5.1 필터 탭, 5.2 상태 배지, 5.4 버튼(Primary: 등록), 모바일에서는 5.3 카드 |
| 프로모션 등록 | 5.6 폼 필드, 5.4 버튼 |
| 프로모션 상세 | 5.2 상태 배지, 5.4 버튼(승인=Primary, 반려/취소=Danger 확정) |
| 변경요청 영역 | 5.2 상태 배지(대기/반영완료/반영거부), 5.4 버튼 |
| 캘린더 | 5.2 상태 배지(프로모션 막대 색상 = 상태색), 모바일에서는 5.3 카드형 리스트 |

---

## 7. 접근성

- 상태 배지 색만으로 상태를 구분하지 않고 항상 텍스트 라벨을 함께 표기한다(색약 사용자 고려, 색상만으로 승인/반려를 구분하지 않음).
- 포인트 컬러(`--color-primary`) 위 흰 텍스트의 대비비는 WCAG AA(4.5:1) 이상을 확인하고 사용한다.
- 포커스 아웃라인(`box-shadow` 방식)은 제거하지 않는다 — 키보드 탐색 시 CJ프레시웨이 담당자가 여러 프로모션을 빠르게 검토하는 워크플로우를 지원한다.
