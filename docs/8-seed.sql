-- CJ프레시웨이 프로모션 협업 앱 - 시드 데이터 (개발/테스트용)
-- 기준 문서: docs/9-plan.md DB-2
-- 반복 실행해도 동일한 상태로 초기화되도록 TRUNCATE 후 재삽입한다.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- notifications는 명시하지 않아도 CASCADE로 함께 비워진다(promotions/users를 FK로 참조).
TRUNCATE TABLE change_requests, promotion_items, promotions, items, users RESTART IDENTITY CASCADE;

-- users: 협력사 2개(서로 다른 소속사), CJ프레시웨이 1개. 비밀번호는 모두 'password123'을 bcrypt로 해시.
INSERT INTO users (id, role, company_name, email, password_hash) VALUES
    ('11111111-1111-1111-1111-111111111111', 'partner',     'ㅇㅇ식품',       'partner1@oofood.example.com', crypt('password123', gen_salt('bf'))),
    ('22222222-2222-2222-2222-222222222222', 'partner',     'ㅁㅁ푸드',       'partner2@mmfood.example.com', crypt('password123', gen_salt('bf'))),
    ('33333333-3333-3333-3333-333333333333', 'cj_freshway', 'CJ프레시웨이',   'reviewer1@cjfreshway.example.com', crypt('password123', gen_salt('bf')));

-- items: 대상 품목
INSERT INTO items (id, name, spec) VALUES
    ('a1111111-0000-0000-0000-000000000001', '국물떡볶이', '500g'),
    ('a1111111-0000-0000-0000-000000000002', '치즈떡볶이', '500g'),
    ('a2222222-0000-0000-0000-000000000001', '냉동만두', '1kg'),
    ('a4444444-0000-0000-0000-000000000001', '김치 5종', NULL);

-- promotions: 상태가 서로 다른 4건 (제안됨/승인됨/종료/반려됨)
INSERT INTO promotions (id, proposer_id, reviewer_id, start_date, end_date, condition, status, reject_reason, cancel_reason) VALUES
    ('b1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', NULL,
        '2026-09-01', '2026-09-30', '15% 할인, 3+1 사은 지원', 'proposed', NULL, NULL),
    ('b2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333',
        '2026-09-05', '2026-09-20', '10% 할인', 'approved', NULL, NULL),
    ('b3333333-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
        '2026-07-01', '2026-07-31', '20% 할인', 'closed', NULL, NULL),
    ('b4444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333',
        '2026-06-01', '2026-06-15', '5% 할인', 'rejected', '지원 조건이 불명확함', NULL);

-- promotion_items: 프로모션-품목 연결
INSERT INTO promotion_items (promotion_id, item_id) VALUES
    ('b1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001'),
    ('b1111111-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000002'),
    ('b2222222-0000-0000-0000-000000000001', 'a2222222-0000-0000-0000-000000000001'),
    ('b3333333-0000-0000-0000-000000000001', 'a4444444-0000-0000-0000-000000000001'),
    ('b4444444-0000-0000-0000-000000000001', 'a1111111-0000-0000-0000-000000000001');
