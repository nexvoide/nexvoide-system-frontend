/**
 * Supabase Edge Function: Storage Cleanup
 * 
 * Deletes expired files from Supabase Storage (older than 3 days / 72 hours)
 * 
 * This function should be scheduled to run daily using pg_cron
 * See: database/setup/cleanup-storage-scheduler.sql
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STORAGE_BUCKET = 'project-attachments'
const DELETE_AFTER_HOURS = 72 // 3 days

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
    
    // Get all files in the bucket
    const { data: files, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'asc' }
      })
    
    if (listError) {
      console.error('❌ Failed to list files:', listError)
      throw listError
    }
    
    if (!files || files.length === 0) {
      console.log('✅ No files to cleanup')
      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted: 0,
          message: 'No files found'
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    
    const now = new Date()
    const expiredFiles: string[] = []
    
    // Check each file's creation time
    for (const file of files) {
      if (file.created_at) {
        const createdAt = new Date(file.created_at)
        const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
        
        if (hoursSinceCreation >= DELETE_AFTER_HOURS) {
          expiredFiles.push(file.name)
        }
      }
    }
    
    if (expiredFiles.length > 0) {
      console.log(`🗑️ Found ${expiredFiles.length} expired files to delete`)
      
      // Delete expired files
      const { error: deleteError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(expiredFiles)
      
      if (deleteError) {
        console.error('❌ Failed to delete files:', deleteError)
        throw deleteError
      }
      
      console.log(`✅ Successfully deleted ${expiredFiles.length} expired files`)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          deleted: expiredFiles.length,
          files: expiredFiles,
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

