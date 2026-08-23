-- CJ프레시웨이 프로모션 협업 앱 - DDL (PostgreSQL 17)
-- 기준 문서: docs/8-erd.md

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role          varchar(20) NOT NULL CHECK (role IN ('partner', 'cj_freshway')),
    company_name  varchar(100) NOT NULL,
    email         varchar(255) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL
);

CREATE TABLE promotions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposer_id    uuid NOT NULL REFERENCES users(id),
    reviewer_id    uuid REFERENCES users(id),
    start_date     date NOT NULL,
    end_date       date NOT NULL,
    condition      text NOT NULL,
    status         varchar(20) NOT NULL DEFAULT 'proposed'
                   CHECK (status IN ('proposed', 'in_review', 'approved', 'rejected', 'active', 'closed', 'cancelled')),
    reject_reason  text,
    cancel_reason  text,

    -- 협력사 실무 제안 속성 (선택 입력, 2026-08-21 v1.5 — docs/1-domain-definition.md 참고)
    discount_type          varchar(20) CHECK (discount_type IN ('정률할인', '정액할인', '사은품', '1+1', '기타')),
    discount_value          numeric,
    partner_cost_share_pct  numeric CHECK (partner_cost_share_pct BETWEEN 0 AND 100),
    moq                     integer,
    available_qty           integer,
    lead_time_days          integer,
    contact_name            varchar(100),
    contact_phone           varchar(50),
    origin_and_cert         text,
    shelf_life_and_storage  text,
    promotion_type          varchar(20) CHECK (promotion_type IN ('신제품출시', '시즌행사', '재고소진', '단순할인', '기타')),
    target_channel          varchar(200),
    attachment_url           varchar(500),

    CHECK (end_date >= start_date)
);

CREATE TABLE items (
    id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(200) NOT NULL,
    spec varchar(100)
);

CREATE TABLE promotion_items (
    promotion_id uuid NOT NULL REFERENCES promotions(id),
    item_id      uuid NOT NULL REFERENCES items(id),
    PRIMARY KEY (promotion_id, item_id)
);

CREATE TABLE change_requests (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id             uuid NOT NULL REFERENCES promotions(id),
    requester_id             uuid NOT NULL REFERENCES users(id),
    content                  text NOT NULL,
    apply_status             varchar(20) NOT NULL DEFAULT 'pending'
                             CHECK (apply_status IN ('pending', 'applied', 'rejected')),
    is_post_approval_change  boolean NOT NULL DEFAULT false
);

CREATE TABLE notifications (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users(id),
    promotion_id  uuid REFERENCES promotions(id),
    type          varchar(30) NOT NULL,
    message       text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_promotions_proposer ON promotions(proposer_id);
CREATE INDEX idx_promotions_reviewer ON promotions(reviewer_id);
CREATE INDEX idx_promotion_items_item ON promotion_items(item_id);
CREATE INDEX idx_change_requests_promotion ON change_requests(promotion_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
