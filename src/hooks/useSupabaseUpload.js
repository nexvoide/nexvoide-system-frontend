import { createClient } from "../lib/supabase";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

const supabase = createClient();

/**
 * Hook for uploading files to Supabase Storage
 * @param {Object} options - Upload options
 * @param {string} options.bucketName - Name of bucket to upload files to in your Supabase project
 * @param {string} [options.path] - Folder to upload files to in the specified bucket within your Supabase project
 * @param {string[]} [options.allowedMimeTypes] - Allowed MIME types for each file upload
 * @param {number} [options.maxFileSize] - Maximum upload size of each file allowed in bytes
 * @param {number} [options.maxFiles=1] - Maximum number of files allowed per upload
 * @param {number} [options.cacheControl=3600] - The number of seconds the asset is cached
 * @param {boolean} [options.upsert=false] - When set to true, the file is overwritten if it exists
 */
export const useSupabaseUpload = (options) => {
  const {
    bucketName,
    path,
    allowedMimeTypes = [],
    maxFileSize = Number.POSITIVE_INFINITY,
    maxFiles = 1,
    cacheControl = 3600,
    upsert = false,
  } = options;

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [successes, setSuccesses] = useState([]);

  const isSuccess = useMemo(() => {
    if (errors.length === 0 && successes.length === 0) {
      return false;
    }
    if (errors.length === 0 && successes.length === files.length) {
      return true;
    }
    return false;
  }, [errors.length, successes.length, files.length]);

  const onDrop = useCallback(
    (acceptedFiles, fileRejections) => {
      const validFiles = acceptedFiles
        .filter((file) => !files.find((x) => x.name === file.name))
        .map((file) => {
          file.preview = URL.createObjectURL(file);
          file.errors = [];
          return file;
        });

      const invalidFiles = fileRejections.map(({ file, errors }) => {
        file.preview = URL.createObjectURL(file);
        file.errors = errors;
        return file;
      });

      const newFiles = [...files, ...validFiles, ...invalidFiles];

      setFiles(newFiles);
    },
    [files, setFiles]
  );

  const dropzoneProps = useDropzone({
    onDrop,
    noClick: true,
    accept: allowedMimeTypes.reduce(
      (acc, type) => ({ ...acc, [type]: [] }),
      {}
    ),
    maxSize: maxFileSize,
    maxFiles: maxFiles,
    multiple: maxFiles !== 1,
  });

  const onUpload = useCallback(async () => {
    setLoading(true);

    // This is to support handling partial successes
    // If any files didn't upload for any reason, hitting "Upload" again will only upload the files that had errors
    const filesWithErrors = errors.map((x) => x.name);
    const filesToUpload =
      filesWithErrors.length > 0
        ? [
            ...files.filter((f) => filesWithErrors.includes(f.name)),
            ...files.filter((f) => !successes.includes(f.name)),
          ]
        : files.filter((f) => !successes.includes(f.name));

    // Mark files as uploading
    setFiles((prevFiles) =>
      prevFiles.map((file) => {
        if (filesToUpload.some((f) => f.name === file.name)) {
          return { ...file, uploading: true };
        }
        return file;
      })
    );

    try {
    const responses = await Promise.all(
      filesToUpload.map(async (file) => {
          try {
            // Generate unique filename to avoid conflicts
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 15);
            const fileName = file.name || `file-${timestamp}`;
            const fileExt = fileName.includes('.') ? fileName.split('.').pop() : '';
            const uniqueFileName = fileExt ? `${timestamp}-${randomId}.${fileExt}` : `${timestamp}-${randomId}`;
            const filePath = !!path ? `${path}/${uniqueFileName}` : uniqueFileName;

            const { data, error } = await supabase.storage
          .from(bucketName)
              .upload(filePath, file, {
            cacheControl: cacheControl.toString(),
            upsert,
          });
            
        if (error) {
              console.error('Upload error for', file.name, ':', error);
              return { name: file.name, message: error.message, path: null };
        } else {
              // Store the uploaded path for later use
              return { name: file.name, message: undefined, path: filePath };
            }
          } catch (err) {
            console.error('Upload exception for', file.name, ':', err);
            return { name: file.name, message: err.message || 'Upload failed', path: null };
        }
      })
    );

      // Mark files as not uploading
      setFiles((prevFiles) =>
        prevFiles.map((file) => {
          if (filesToUpload.some((f) => f.name === file.name)) {
            return { ...file, uploading: false };
          }
          return file;
        })
      );

    const responseErrors = responses.filter((x) => x.message !== undefined);
    // if there were errors previously, this function tried to upload the files again so we should clear/overwrite the existing errors.
    setErrors(responseErrors);

    const responseSuccesses = responses.filter((x) => x.message === undefined);
    const newSuccesses = Array.from(
      new Set([...successes, ...responseSuccesses.map((x) => x.name)])
    );
    setSuccesses(newSuccesses);

      // Store upload paths in file objects
      setFiles((prevFiles) =>
        prevFiles.map((file) => {
          const success = responseSuccesses.find((r) => r.name === file.name);
          if (success) {
            return { ...file, uploadPath: success.path, uploaded: true };
          }
          return file;
        })
      );
    } catch (err) {
      console.error('Upload error:', err);
      // Mark files as not uploading on error
      setFiles((prevFiles) =>
        prevFiles.map((file) => {
          if (filesToUpload.some((f) => f.name === file.name)) {
            return { ...file, uploading: false };
          }
          return file;
        })
      );
    } finally {
    setLoading(false);
    }
  }, [files, path, bucketName, errors, successes, cacheControl, upsert]);

  useEffect(() => {
    if (files.length === 0) {
      setErrors([]);
    }

    // If the number of files doesn't exceed the maxFiles parameter, remove the error 'Too many files' from each file
    if (files.length <= maxFiles) {
      let changed = false;
      const newFiles = files.map((file) => {
        if (
          file.errors &&
          file.errors.some((e) => e.code === "too-many-files")
        ) {
          file.errors = file.errors.filter((e) => e.code !== "too-many-files");
          changed = true;
        }
        return file;
      });
      if (changed) {
        setFiles(newFiles);
      }
    }
  }, [files.length, maxFiles]);

  return {
    files,
    setFiles,
    successes,
    isSuccess,
    loading,
    errors,
    setErrors,
    onUpload,
    maxFileSize: maxFileSize,
    maxFiles: maxFiles,
    allowedMimeTypes,
    ...dropzoneProps,
  };
};
