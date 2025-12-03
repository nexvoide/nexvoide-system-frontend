-- ============================================================================
-- NEXVOIDE STORAGE BUCKETS SETUP
-- ============================================================================
-- This file creates all storage buckets needed for file uploads
-- Run this AFTER running supabase-complete-setup.sql
-- ============================================================================

-- Note: Storage buckets must be created via Supabase Dashboard or API
-- This SQL file provides the configuration details for manual creation

-- ============================================================================
-- STORAGE BUCKET 1: project-attachments
-- ============================================================================
-- Purpose: Store project-related files (source files, deliverables, etc.)
-- Configuration:
--   - Name: project-attachments
--   - Public: Yes (for easy access)
--   - File size limit: 50MB
--   - Allowed MIME types:
--     * image/* (all images)
--     * video/* (all videos)
--     * application/pdf
--     * application/zip
--     * application/x-zip-compressed
--     * text/*
--     * application/msword
--     * application/vnd.openxmlformats-officedocument.wordprocessingml.document

-- To create via Supabase Dashboard:
-- 1. Go to Storage > New bucket
-- 2. Name: project-attachments
-- 3. Public bucket: Yes
-- 4. File size limit: 52428800 (50MB in bytes)
-- 5. Allowed MIME types: (see above)

-- Storage policies for project-attachments bucket
-- (Run these after creating the bucket)

-- Allow public read access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'project-attachments',
    'project-attachments',
    true,
    52428800, -- 50MB
    ARRAY[
        'image/*',
        'video/*',
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'text/*',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
        'image/*',
        'video/*',
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'text/*',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

-- RLS Policies for project-attachments
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'project-attachments');

CREATE POLICY "Authenticated users can upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'project-attachments' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can update" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'project-attachments' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'project-attachments' AND
        auth.role() = 'authenticated'
    );

-- ============================================================================
-- STORAGE BUCKET 2: chat-files
-- ============================================================================
-- Purpose: Store chat message attachments
-- Configuration:
--   - Name: chat-files
--   - Public: Yes (for easy access)
--   - File size limit: 50MB
--   - Allowed MIME types: Same as project-attachments

-- To create via Supabase Dashboard:
-- 1. Go to Storage > New bucket
-- 2. Name: chat-files
-- 3. Public bucket: Yes
-- 4. File size limit: 52428800 (50MB in bytes)
-- 5. Allowed MIME types: (same as project-attachments)

-- Storage policies for chat-files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-files',
    'chat-files',
    true,
    52428800, -- 50MB
    ARRAY[
        'image/*',
        'video/*',
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'text/*',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
        'image/*',
        'video/*',
        'application/pdf',
        'application/zip',
        'application/x-zip-compressed',
        'text/*',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

-- RLS Policies for chat-files
CREATE POLICY "Public Access for chat-files" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-files');

CREATE POLICY "Authenticated users can upload to chat-files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'chat-files' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can update chat-files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'chat-files' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can delete chat-files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'chat-files' AND
        auth.role() = 'authenticated'
    );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if buckets were created
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('project-attachments', 'chat-files');

-- ============================================================================
-- COMPLETE!
-- ============================================================================
-- Storage buckets and policies have been created.
-- Files can now be uploaded to:
--   - project-attachments (for project files)
--   - chat-files (for chat attachments)
-- ============================================================================

