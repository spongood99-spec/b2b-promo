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

CREATE INDEX idx_promotions_proposer ON promotions(proposer_id);
CREATE INDEX idx_promotions_reviewer ON promotions(reviewer_id);
CREATE INDEX idx_promotion_items_item ON promotion_items(item_id);
CREATE INDEX idx_change_requests_promotion ON change_requests(promotion_id);
