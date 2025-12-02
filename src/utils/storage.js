/**
 * Supabase Storage utility for file uploads
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

const STORAGE_BUCKET = 'project-attachments';
const DELETE_AFTER_HOURS = 72;

/**
 * Initialize storage bucket (run once in Supabase dashboard)
 */
export async function initializeStorage() {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('⚠️ Supabase not configured. Cannot initialize storage.');
    return;
  }

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
    
    if (!bucketExists) {
      // Create bucket with public access for downloads
      const { data, error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
        allowedMimeTypes: ['image/*', 'video/*', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      });
      
      if (error) {
        console.error('❌ Failed to create storage bucket:', error);
        throw error;
      }
      console.log('✅ Storage bucket created:', data);
    } else {
      console.log('✅ Storage bucket already exists');
    }
  } catch (error) {
    console.error('❌ Failed to initialize storage:', error);
    throw error;
  }
}

/**
 * Upload file to Supabase Storage
 * @param {File} file - File to upload
 * @param {string} projectId - Project ID (optional, for organization)
 * @returns {Promise<{url: string, path: string, expiresAt: string}>}
 */
export async function uploadFile(file, projectId = null) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase storage is not configured');
  }

  if (!file) {
    throw new Error('No file provided');
  }

  // Validate file size (50MB max)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    throw new Error(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
  }

  try {
    // Check if bucket exists, create if it doesn't
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.warn('⚠️ Could not list buckets:', listError);
      // Continue anyway - the upload will fail with a clearer error if bucket doesn't exist
    } else {
      const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);
      if (!bucketExists) {
        console.log('📦 Storage bucket not found. Attempting to create:', STORAGE_BUCKET);
        const { data: bucketData, error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
          public: true,
          fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
          allowedMimeTypes: ['image/*', 'video/*', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        });
        
        if (createError) {
          console.error('❌ Failed to create storage bucket automatically:', createError);
          // Don't throw here - let the upload attempt happen so we can provide a clearer error
          // Bucket creation might require admin privileges that anon key doesn't have
        } else {
          console.log('✅ Storage bucket created successfully');
        }
      }
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomId}.${fileExt}`;
    
    // Organize by project ID if provided
    const filePath = projectId ? `${projectId}/${fileName}` : fileName;

    // Upload file
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Upload error:', error);
      // Provide more helpful error message for bucket not found
      if (error.message && (error.message.includes('Bucket not found') || error.message.includes('does not exist') || error.message.includes('not found'))) {
        throw new Error(
          `Storage bucket "${STORAGE_BUCKET}" not found. ` +
          `Please create it in your Supabase Dashboard > Storage with the following settings:\n` +
          `- Name: ${STORAGE_BUCKET}\n` +
          `- Public: Yes\n` +
          `- File size limit: 50MB\n` +
          `Alternatively, run the SQL setup script (supabase-complete-setup.sql) in your Supabase SQL Editor.`
        );
      }
      // Provide more helpful error message for RLS policy errors
      if (error.message && error.message.includes('row-level security')) {
        throw new Error('Storage policy error: Please run the SQL in supabase-complete-setup.sql in your Supabase SQL Editor to fix this issue.');
      }
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    // Calculate expiration time (72 hours from now)
    const expiresAt = new Date(Date.now() + DELETE_AFTER_HOURS * 60 * 60 * 1000).toISOString();

    return {
      url: urlData.publicUrl,
      path: filePath,
      name: file.name,
      size: file.size,
      type: file.type,
      expiresAt: expiresAt
    };
  } catch (error) {
    console.error('❌ Failed to upload file:', error);
    throw error;
  }
}

/**
 * Delete file from Supabase Storage
 * @param {string} filePath - Path to file in storage
 */
export async function deleteFile(filePath) {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('⚠️ Supabase not configured. Cannot delete file.');
    return;
  }

  if (!filePath) {
    console.warn('⚠️ No file path provided');
    return;
  }

  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('❌ Failed to delete file:', error);
      throw error;
    }

    console.log('✅ File deleted:', filePath);
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    throw error;
  }
}

/**
 * Delete multiple files
 * @param {string[]} filePaths - Array of file paths
 */
export async function deleteFiles(filePaths) {
  if (!isSupabaseConfigured || !supabase || !filePaths || filePaths.length === 0) {
    return;
  }

  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(filePaths);

    if (error) {
      console.error('❌ Failed to delete files:', error);
      throw error;
    }

    console.log(`✅ Deleted ${filePaths.length} files`);
  } catch (error) {
    console.error('❌ Error deleting files:', error);
    throw error;
  }
}

/**
 * Check and delete expired files
 * This should be called periodically (e.g., via Supabase Edge Function or cron job)
 */
export async function cleanupExpiredFiles() {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('⚠️ Supabase not configured. Cannot cleanup files.');
    return;
  }

  try {
    // Get all files in the bucket
    const { data: files, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      });

    if (listError) {
      console.error('❌ Failed to list files:', listError);
      return;
    }

    if (!files || files.length === 0) {
      console.log('✅ No files to cleanup');
      return;
    }

    const now = new Date();
    const expiredFiles = [];

    // Check each file's creation time
    for (const file of files) {
      if (file.created_at) {
        const createdAt = new Date(file.created_at);
        const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
        
        if (hoursSinceCreation >= DELETE_AFTER_HOURS) {
          expiredFiles.push(file.name);
        }
      }
    }

    if (expiredFiles.length > 0) {
      console.log(`🗑️ Found ${expiredFiles.length} expired files to delete`);
      await deleteFiles(expiredFiles);
    } else {
      console.log('✅ No expired files found');
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}
