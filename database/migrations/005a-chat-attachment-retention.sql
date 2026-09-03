BEGIN;

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/rtf',
        'application/zip'
    ]
WHERE id = 'chat-files';

COMMIT;
