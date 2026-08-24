# ERD - CJ프레시웨이 프로모션 협업 앱

> 기준 문서: `1-domain-definition.md`(v1.8), `2-prd.md`(v1.1), `5-project-principle.md`

```mermaid
erDiagram
    users ||--o{ promotions : "제안 (proposer_id)"
    users ||--o{ promotions : "검토·승인 (reviewer_id)"
    users ||--o{ change_requests : "요청 (requester_id)"
    promotions ||--o{ change_requests : "협의/변경이력"
    promotions ||--o{ promotion_items : "대상 품목"
    items ||--o{ promotion_items : "적용 프로모션"
    users ||--o{ notifications : "수신 (user_id)"
    promotions ||--o{ notifications : "관련 알림 (nullable)"

    users {
        string id PK
        string role "partner | cj_freshway"
        string company_name
        string email
        string password_hash
    }

    promotions {
        string id PK
        string proposer_id FK "users.id, 협력사 담당자"
        string reviewer_id FK "users.id, CJ프레시웨이 담당자, nullable"
        date start_date
        date end_date
        string condition "가격/할인율/지원조건 텍스트"
        string status "proposed|in_review|approved|rejected|active|closed|cancelled"
        string reject_reason "nullable"
        string cancel_reason "nullable"
        string discount_type "정률할인|정액할인|사은품|1+1|기타, nullable (v1.5)"
        number discount_value "nullable (v1.5)"
        number partner_cost_share_pct "0~100, nullable (v1.5)"
        number moq "최소주문수량, nullable (v1.5)"
        number available_qty "공급가능수량, nullable (v1.5)"
        number lead_time_days "nullable (v1.5)"
        string contact_name "nullable (v1.5)"
        string contact_phone "nullable (v1.5)"
        string origin_and_cert "nullable (v1.5)"
        string shelf_life_and_storage "nullable (v1.5)"
        string promotion_type "신제품출시|시즌행사|재고소진|단순할인|기타, nullable (v1.5)"
        string target_channel "nullable (v1.5)"
        string attachment_url "nullable (v1.5)"
        datetime created_at "2026-08-24 추가"
        datetime updated_at "상태/내용 변경 시 트리거로 자동 갱신, 2026-08-24 추가"
    }

    items {
        string id PK
        string name
        string spec "nullable"
    }

    promotion_items {
        string promotion_id FK
        string item_id FK
    }

    change_requests {
        string id PK
        string promotion_id FK
        string requester_id FK "users.id, 협력사 담당자"
        string content
        string apply_status "pending|applied|rejected"
        boolean is_post_approval_change
        datetime created_at "목록 정렬 기준, 2026-08-24 추가"
    }

    notifications {
        string id PK
        string user_id FK "users.id, 수신자"
        string promotion_id FK "nullable"
        string type "new_promotion|approved|rejected|resubmitted|new_change_request|change_request_applied|change_request_rejected"
        string message
        boolean is_read "기본값 false, 2026-08-24 추가"
        datetime created_at
    }
```

## 테이블 설명

- **users**: 도메인 정의서 3장의 사용자(User). 협력사/CJ프레시웨이 담당자를 `role`로 구분해 단일 테이블에 저장한다.
- **promotions**: 도메인 정의서 3장의 프로모션(Promotion). 제안자(`proposer_id`)는 필수, 검토자(`reviewer_id`)는 검토/승인/반려/취소 시점에 채워지므로 nullable이다. `discount_type`~`attachment_url`은 협력사 실무 제안 속성으로 전부 선택 입력이다(v1.5, 2026-08-21). `partner_cost_share_pct`는 합의된 조건만 기록하며 실제 정산 처리는 하지 않는다(도메인 정의서 5장 Don't 규칙 준수). `attachment_url`은 파일 업로드 저장소 없이 외부 링크만 저장한다. `created_at`/`updated_at`은 도메인 정의서 5장 Do 규칙(변경 시각 기록)을 지키기 위해 2026-08-24 전체 회귀 테스트에서 추가되었다 — `updated_at`은 `trg_promotions_updated_at` 트리거가 UPDATE마다 자동 갱신한다(서비스 코드 6곳에 각각 반영하는 대신 트리거 하나로 일원화).
- **items**: 도메인 정의서 3장의 대상품목(Item). PRD FR-2에 따라 별도 CRUD 화면 없이 프로모션 등록 폼에서 즉시 생성된다. 한 프로모션당 최대 50개까지 등록할 수 있다(2026-08-24, 대량 등록으로 인한 응답 지연 방지).
- **promotion_items**: 프로모션과 대상품목의 N:M 관계를 표현하는 연결 테이블(PRD 6장 실제 테이블명).
- **change_requests**: 도메인 정의서 3장의 변경요청(ChangeRequest). `is_post_approval_change`로 EC-03(승인후변경) 여부를 구분한다. 이미 처리된(`applied`/`rejected`) 건은 재처리할 수 없다(2026-08-24, 반복 처리로 상태가 뒤집히고 알림이 중복 발송되는 문제 방지). `created_at`은 목록을 등록순으로 정렬하기 위해 2026-08-24 추가되었다(그전에는 컬럼이 없어 DB 삽입순서에 의존했다).
- **notifications**: FR-13(2026-08-21 추가)의 알림. 담당 MD 지정 기능이 없어 CJ프레시웨이용 알림은 전체 CJ프레시웨이 계정에 각각 한 행씩 브로드캐스트된다. `promotions`와 달리 알림은 최신순 조회가 필수 요구사항이라 `created_at`을 둔다(다른 테이블은 정렬 요구가 없어 생략). `is_read`는 헤더 벨의 안읽은 개수 표시와 `/notifications` 전체보기 화면의 개별/전체 읽음 처리를 위해 2026-08-24 추가되었다(FR-13 확장).
