-- ============================================================================
-- INSERT EMPLOYEE DATA
-- ============================================================================
-- This file contains INSERT statements for employee records
-- Run this after creating the employees table
-- ============================================================================

INSERT INTO employees (
    id,
    name,
    role,
    email,
    phone,
    bank_name,
    bank_account,
    avatar,
    notes,
    active,
    rate_type,
    rate_value,
    street,
    city,
    state,
    country,
    zip,
    created_at,
    updated_at
) VALUES
-- Employee 1: Shahab
(
    '3f2c0057-2381-4e07-8ae8-322a1044634c',
    'Shahab',
    'Graphic Designer',
    'shahabfb01@gmail.com',
    '3485707855',
    'JazzCash',
    '3485707855',
    NULL, -- avatar: data:image/webp;base64... (too long, set to NULL or provide separately)
    NULL, -- notes: (long string, set to NULL or provide separately)
    true,
    'fixed',
    0,
    NULL,
    'Lahore',
    NULL,
    'Pakistan',
    NULL,
    '2025-12-07 08:42:05.196773+00',
    '2025-12-31 10:06:42.705769+00'
),

-- Employee 2: Muhammad Zubair
(
    uuid_generate_v4(),
    'Muhammad Zubair',
    'Video Editor',
    'dazistudin1275@gmail.com',
    '923407000000', -- converted from 9.23407E+11
    'Meezan Bank',
    '300112000000', -- converted from 3.00112E+11
    NULL,
    NULL,
    true,
    'fixed',
    0,
    NULL,
    'Qasur',
    NULL,
    'Pakistan',
    NULL,
    NOW(),
    NOW()
),

-- Employee 3: Niyaz Ansari
(
    uuid_generate_v4(),
    'Niyaz Ansari',
    NULL,
    'niyaz291102@gmail.com',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    true,
    'fixed',
    0,
    NULL,
    'Mumbai',
    NULL,
    'India',
    NULL,
    NOW(),
    NOW()
),

-- Employee 4: Abdul Wahab
(
    uuid_generate_v4(),
    'Abdul Wahab',
    NULL,
    'zubair@nexvoide.com',
    '+92 312 4477952',
    'Binance',
    NULL,
    NULL,
    NULL,
    true,
    'fixed',
    0,
    NULL,
    'Faisalabad',
    NULL,
    'Pakistan',
    NULL,
    NOW(),
    NOW()
),

-- Employee 5: Abdullah Razzaq
(
    uuid_generate_v4(),
    'Abdullah Razzaq',
    NULL,
    'rajawahab4477@gmail.com',
    NULL,
    'Bank Al Falah',
    'PK71ABPA0010100556520014',
    NULL,
    NULL,
    true,
    'fixed',
    0,
    NULL,
    'Rawalpindi',
    NULL,
    'Pakistan',
    NULL,
    NOW(),
    NOW()
),

-- Employee 6: Ali Ahmad
(
    uuid_generate_v4(),
    'Ali Ahmad',
    NULL,
    'razzaqabdullah92@gmail.com',
    NULL,
    'United Bank Limited',
    NULL,
    NULL,
    NULL,
    true,
    'fixed',
    0,
    NULL,
    'Lodhran',
    NULL,
    'Pakistan',
    NULL,
    NOW(),
    NOW()
),

-- Employee 7: Abdullah Rehan
(
    uuid_generate_v4(),
    'Abdullah Rehan',
    NULL,
    'lkfgaming7583@gmail.com',
    NULL,
    'Allied Bank',
    NULL,
    NULL,
    NULL,
    true,
    'fixed',
    0,
    NULL,
    'Paharapur',
    NULL,
    'Pakistan',
    NULL,
    NOW(),
    NOW()
),

-- Employee 8: (from email pantherlovking@gmail.com)
(
    uuid_generate_v4(),
    'Abdullah Rehan', -- or another name if different
    NULL,
    'pantherlovking@gmail.com',
    NULL,
    'Nayapay',
    NULL,
    NULL,
    NULL,
    true,
    'fixed',
    0,
    NULL,
    NULL,
    NULL,
    'Pakistan',
    NULL,
    NOW(),
    NOW()
),

-- Employee 9: (from email abdullah@nexvoide.com)
(
    uuid_generate_v4(),
    'Abdullah', -- or full name if known
    NULL,
    'abdullah@nexvoide.com',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    true,
    'fixed',
    0,
    NULL,
    NULL,
    NULL,
    'Pakistan',
    NULL,
    NOW(),
    NOW()
);

-- ============================================================================
-- NOTE: 
-- - Avatar and notes fields are set to NULL as they contain very long base64
--   encoded data. If you need to include them, you'll need to provide the full
--   base64 strings separately.
-- - Phone numbers in scientific notation have been converted to full numbers
-- - Timestamps for new records use NOW() - adjust if you need specific dates
-- - Only the first employee has the original UUID preserved
-- ============================================================================

