/**
 * Supabase Edge Function: Storage Cleanup
 * 
 * Deletes expired files from Supabase Storage (older than 3 days / 72 hours)
 * 
 * This function should be scheduled to run daily using Supabase Cron Jobs
 * or pg_cron. See setup instructions below.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Deploy this function: supabase functions deploy cleanup-storage
 * 2. Set up cron job in Supabase Dashboard > Database > Cron Jobs:
 *    - Schedule: 0 2 * * * (runs daily at 2 AM)
 *    - SQL: SELECT net.http_post(
 *        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-storage',
 *        headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
 *      );
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STORAGE_BUCKET = 'project-attachments'
const DELETE_AFTER_HOURS = 72 // 3 days

/**
 * Recursively list all files in a directory and subdirectories
 */
async function listAllFiles(
  supabase: any,
  bucket: string,
  folder: string = '',
  allFiles: Array<{ path: string; name: string; created_at?: string }> = []
): Promise<Array<{ path: string; name: string; created_at?: string }>> {
  const { data: items, error } = await supabase.storage
    .from(bucket)
    .list(folder, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' }
    })

  if (error) {
    console.error(`❌ Error listing folder ${folder}:`, error)
    return allFiles
  }

  if (!items || items.length === 0) {
    return allFiles
  }

  for (const item of items) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name

    // In Supabase Storage:
    // - Files have: name, id, created_at, updated_at, last_accessed_at, metadata
    // - Folders have: name, id (but no created_at, updated_at, or metadata)
    // Check if it's a folder by trying to list it (folders can be listed, files cannot)
    // OR check if it lacks file-specific properties
    
    const isLikelyFolder = !item.created_at && !item.updated_at && !item.metadata
    
    if (isLikelyFolder) {
      // It's likely a folder, try to recurse into it
      console.log(`📁 Found folder: ${itemPath}, recursing...`)
      await listAllFiles(supabase, bucket, itemPath, allFiles)
    } else {
      // It's a file, add it to the list
      console.log(`📄 Found file: ${itemPath} (created: ${item.created_at || 'unknown'})`)
      allFiles.push({
        path: itemPath,
        name: item.name,
        created_at: item.created_at
      })
    }
  }

  return allFiles
}

/**
 * Extract timestamp from filename
 * Files are named: timestamp-randomId.ext
 * Example: 1701234567890-abc123.pdf
 */
function getTimestampFromFilename(filename: string): number | null {
  try {
    // Extract the timestamp part (before the first hyphen)
    const parts = filename.split('-')
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[0], 10)
      if (!isNaN(timestamp) && timestamp > 0) {
        return timestamp
      }
    }
    return null
  } catch {
    return null
  }
}

serve(async (req) => {
  try {
    // Get Supabase credentials from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials')
    }
    
    // Create Supabase client with service role key (has admin permissions)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    console.log('🧹 Starting storage cleanup...')
    console.log(`📦 Bucket: ${STORAGE_BUCKET}`)
    
    // First, check what's in the root
    const { data: rootItems, error: rootError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list('', { limit: 100 })
    
    if (rootError) {
      console.error('❌ Error listing root:', rootError)
    } else {
      console.log(`📋 Root folder contains ${rootItems?.length || 0} items:`)
      rootItems?.forEach(item => {
        console.log(`   - ${item.name} (${item.created_at ? 'file' : 'folder'})`)
      })
    }
    
    // Recursively get all files from all folders
    console.log('🔍 Recursively listing all files...')
    const allFiles = await listAllFiles(supabase, STORAGE_BUCKET)
    
    if (allFiles.length === 0) {
      console.log('⚠️ No files found in bucket')
      console.log('💡 This could mean:')
      console.log('   1. Bucket is empty')
      console.log('   2. Files are in folders that weren\'t detected')
      console.log('   3. Permission issue accessing files')
      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted: 0,
          message: 'No files found',
          rootItemsCount: rootItems?.length || 0
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`📁 Found ${allFiles.length} total files to check`)
    
    const now = Date.now()
    const expiredFiles: string[] = []
    
    // Check each file's age
    for (const file of allFiles) {
      let fileTimestamp: number | null = null
      let timestampSource = 'unknown'
      
      // Try to get timestamp from created_at first
      if (file.created_at) {
        const createdAt = new Date(file.created_at).getTime()
        if (!isNaN(createdAt) && createdAt > 0) {
          fileTimestamp = createdAt
          timestampSource = 'created_at'
          console.log(`📅 File: ${file.path}, created_at: ${file.created_at}, parsed: ${new Date(createdAt).toISOString()}`)
        }
      }
      
      // Fallback: extract timestamp from filename
      if (!fileTimestamp) {
        const filenameTimestamp = getTimestampFromFilename(file.name)
        if (filenameTimestamp) {
          fileTimestamp = filenameTimestamp
          timestampSource = 'filename'
          console.log(`📅 File: ${file.path}, filename timestamp: ${new Date(filenameTimestamp).toISOString()}`)
        }
      }
      
      if (fileTimestamp) {
        const hoursSinceCreation = (now - fileTimestamp) / (1000 * 60 * 60)
        const daysSinceCreation = hoursSinceCreation / 24
        
        console.log(`🔍 Checking: ${file.path} - ${Math.round(hoursSinceCreation)}h (${daysSinceCreation.toFixed(2)}d) old [source: ${timestampSource}]`)
        
        if (hoursSinceCreation >= DELETE_AFTER_HOURS) {
          expiredFiles.push(file.path)
          console.log(`⏰ EXPIRED: ${file.path} (${Math.round(hoursSinceCreation)} hours / ${daysSinceCreation.toFixed(2)} days old)`)
        } else {
          console.log(`✅ Still valid: ${file.path} (${Math.round(hoursSinceCreation)} hours old, needs ${DELETE_AFTER_HOURS}h)`)
        }
      } else {
        // If we can't determine age, log it but don't delete (safety)
        console.warn(`⚠️ Could not determine age for file: ${file.path} (name: ${file.name}, created_at: ${file.created_at || 'null'})`)
      }
    }
    
    if (expiredFiles.length > 0) {
      console.log(`🗑️ Found ${expiredFiles.length} expired files to delete`)
      
      // Delete expired files in batches (Supabase has a limit)
      const BATCH_SIZE = 100
      let deletedCount = 0
      
      for (let i = 0; i < expiredFiles.length; i += BATCH_SIZE) {
        const batch = expiredFiles.slice(i, i + BATCH_SIZE)
        
        const { error: deleteError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(batch)
        
        if (deleteError) {
          console.error(`❌ Failed to delete batch ${i / BATCH_SIZE + 1}:`, deleteError)
          // Continue with next batch instead of failing completely
        } else {
          deletedCount += batch.length
          console.log(`✅ Deleted batch ${i / BATCH_SIZE + 1}: ${batch.length} files`)
        }
      }
      
      console.log(`✅ Successfully deleted ${deletedCount} expired files`)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted: deletedCount,
          totalChecked: allFiles.length,
          expiredFound: expiredFiles.length,
          files: expiredFiles.slice(0, 50), // Return first 50 for logging
          timestamp: new Date().toISOString()
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } else {
      console.log('✅ No expired files found')
      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted: 0,
          totalChecked: allFiles.length,
          message: 'No expired files',
          timestamp: new Date().toISOString()
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

