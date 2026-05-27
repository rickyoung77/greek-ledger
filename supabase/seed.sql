-- ============================================================
-- Greek Ledger — Seed Data
-- Run AFTER schema.sql. Uses fixed UUIDs so foreign keys line up.
-- ============================================================

-- ── 1. Chapter ───────────────────────────────────────────────
insert into chapters (id, name, semester) values (
  '00000000-0000-0000-0000-000000000001',
  'Alpha Beta Chapter',
  'Spring 2026'
) on conflict (id) do nothing;


-- ── 2. Members ───────────────────────────────────────────────
insert into members (id, chapter_id, full_name, role, year, dues_status, email) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Jake Davis',    'Treasurer',      'Senior',    'Paid',    'jake.davis@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Mike Chen',     'President',      'Senior',    'Paid',    'mike.chen@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Ryan Torres',   'Vice President', 'Junior',    'Paid',    'ryan.torres@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Chris Lee',     'Social Chair',   'Junior',    'Pending', 'chris.lee@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Alex Park',     'Member',         'Sophomore', 'Paid',    'alex.park@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Sam Wilson',    'Secretary',      'Junior',    'Paid',    'sam.wilson@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Jordan King',   'Member',         'Freshman',  'Pending', 'jordan.king@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Tyler Scott',   'Member',         'Sophomore', 'Paid',    'tyler.scott@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Brandon Hall',  'Member',         'Junior',    'Paid',    'brandon.hall@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Derek Nguyen',  'Risk Manager',   'Senior',    'Paid',    'derek.nguyen@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Marcus Brown',  'Member',         'Freshman',  'Pending', 'marcus.brown@alphabeta.org'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Owen Clark',    'Philanthropy Chair', 'Junior', 'Paid',  'owen.clark@alphabeta.org')
on conflict (id) do nothing;


-- ── 3. Budget Accounts (top-level) ───────────────────────────
insert into budget_accounts (id, chapter_id, parent_id, name, total_budget, color) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', null, 'Social Chair',  10000.00, '#3b82f6'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', null, 'Operations',     4000.00, '#f97316'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', null, 'Philanthropy',   2000.00, '#22c55e'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', null, 'Housing',        5000.00, '#8b5cf6')
on conflict (id) do nothing;

-- Sub-accounts — Social Chair
insert into budget_accounts (id, chapter_id, parent_id, name, total_budget, color) values
  ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Fall Formal',     3500.00, '#3b82f6'),
  ('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Mixers',           2000.00, '#3b82f6'),
  ('20000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Date Functions',   2500.00, '#3b82f6'),
  ('20000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Road Trips',       2000.00, '#3b82f6')
on conflict (id) do nothing;

-- Sub-accounts — Operations
insert into budget_accounts (id, chapter_id, parent_id, name, total_budget, color) values
  ('20000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Insurance',        1500.00, '#f97316'),
  ('20000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'National Dues',    1500.00, '#f97316'),
  ('20000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Office Supplies',  1000.00, '#f97316')
on conflict (id) do nothing;

-- Sub-accounts — Philanthropy
insert into budget_accounts (id, chapter_id, parent_id, name, total_budget, color) values
  ('20000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '5K Event',         1000.00, '#22c55e'),
  ('20000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Donations',         500.00, '#22c55e'),
  ('20000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Fundraisers',       500.00, '#22c55e')
on conflict (id) do nothing;

-- Sub-accounts — Housing
insert into budget_accounts (id, chapter_id, parent_id, name, total_budget, color) values
  ('20000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Repairs',          2500.00, '#8b5cf6'),
  ('20000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Utilities',        1500.00, '#8b5cf6'),
  ('20000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', 'Cleaning',         1000.00, '#8b5cf6')
on conflict (id) do nothing;


-- ── 4. Expenses ──────────────────────────────────────────────
insert into expenses (id, chapter_id, budget_account_id, description, amount, category, submitted_by, status, date) values
  -- Social
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011', 'Fall Formal venue deposit',         2500.00, 'Social',       'Jake Davis',  'Approved', '2026-05-24'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000012', 'DJ for spring mixer',                800.00, 'Social',       'Alex Park',   'Pending',  '2026-05-16'),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000013', 'Date function catering',            1900.00, 'Social',       'Jake Davis',  'Approved', '2026-05-10'),
  ('30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000014', 'Road trip to regional conference',  1800.00, 'Social',       'Alex Park',   'Approved', '2026-04-28'),
  -- Housing
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000041', 'Roof repair — east wing',           1858.00, 'Housing',      'Mike Chen',   'Pending',  '2026-05-22'),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000042', 'Monthly utilities bill',             892.50, 'Housing',      'Mike Chen',   'Approved', '2026-05-08'),
  ('30000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000043', 'House cleaning service',             420.00, 'Housing',      'Sam Wilson',  'Approved', '2026-04-22'),
  -- Operations
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000022', 'National headquarters dues',        1200.00, 'Operations',   'Ryan Torres', 'Approved', '2026-05-20'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000023', 'Office supplies & printer ink',      156.75, 'Operations',   'Sam Wilson',  'Rejected', '2026-05-12'),
  ('30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000021', 'Chapter insurance premium',         1200.00, 'Operations',   'Ryan Torres', 'Pending',  '2026-05-02'),
  -- Philanthropy
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000031', '5K charity run registration',        450.00, 'Philanthropy', 'Chris Lee',   'Approved', '2026-05-18'),
  ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000032', 'Donation to local food bank',        250.00, 'Philanthropy', 'Chris Lee',   'Approved', '2026-05-05')
on conflict (id) do nothing;


-- ── 5. Notifications ─────────────────────────────────────────
insert into notifications (id, chapter_id, title, message, type, read, created_at) values
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Expense approved',
    'Fall Formal venue deposit ($2,500) has been approved by the chapter advisor.',
    'approval', false,
    now() - interval '2 hours'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Expense pending review',
    'Roof repair — east wing ($1,858) is awaiting your approval.',
    'pending', false,
    now() - interval '5 hours'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Dues reminder sent',
    'A dues reminder was sent to 3 members with outstanding balances.',
    'dues', true,
    now() - interval '1 day'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Budget threshold reached',
    'Social Chair account has reached 80% of its total budget.',
    'budget', true,
    now() - interval '2 days'
  ),
  (
    '40000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Expense rejected',
    'Office supplies & printer ink ($156.75) was rejected. Please resubmit with itemized receipt.',
    'rejection', true,
    now() - interval '3 days'
  ),
  (
    '40000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'Monthly report ready',
    'Your April 2026 financial summary report is ready to download.',
    'report', true,
    now() - interval '5 days'
  )
on conflict (id) do nothing;
