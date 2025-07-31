import { useState, useRef, useEffect } from "react";

export const useResumableUpload = () => {
  const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB chunks

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, uploading, completed, error
  const [errorMessage, setErrorMessage] = useState("");
  const [bytesTransferred, setBytesTransferred] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [fileId, setFileId] = useState();
  const [fileChunks, setFileChunks] = useState([]);
  const [hasExistingUpload, setHasExistingUpload] = useState(false);
  const [assemblyResult, setAssemblyResult] = useState(null);

  const uploadProgressRef = useRef();
  const isPausedRef = useRef(false);
  const abortControllerRef = useRef(null);

  const checkForExistingUploads = () => {
    const keys = Object.keys(localStorage);
    const uploadKeys = keys.filter((key) => key.startsWith("upload-"));

    if (uploadKeys.length > 0) {
      let latestUpload = null;
      let latestTimestamp = 0;

      for (const key of uploadKeys) {
        try {
          const uploadData = JSON.parse(localStorage.getItem(key));

          if (uploadData.uploadedChunks.length >= uploadData.totalChunks) {
            localStorage.removeItem(key);
            continue;
          }

          if (uploadData.uploadedChunks.length > 0) {
            const timestamp = uploadData.timestamp || 0;

            if (timestamp > latestTimestamp) {
              latestTimestamp = timestamp;
              latestUpload = uploadData;
            }
          }
        } catch (error) {
          console.error("Error parsing upload data:", error);

          localStorage.removeItem(key);
        }
      }

      if (latestUpload) {
        setFileId(latestUpload.fileId);
        setTotalBytes(latestUpload.totalSize);
        setUploadStatus("idle");
        setHasExistingUpload(true);

        console.log(
          "Found existing upload, waiting for user to select same file:",
          latestUpload
        );
        return latestUpload;
      }
    }
    return null;
  };

  useEffect(() => {
    checkForExistingUploads();
  }, []);

  const isResumable = (file) => {
    const fid = generateFileId(file);
    const rawLocalMetaAvailable = localStorage.getItem(`upload-${fid}`);

    if (!rawLocalMetaAvailable) {
      return false;
    }

    try {
      const localMetaAvailable = JSON.parse(rawLocalMetaAvailable);

      if (
        localMetaAvailable.uploadedChunks.length ===
        localMetaAvailable.totalChunks
      ) {
        return false;
      }

      if (
        localMetaAvailable.fileName === file.name &&
        localMetaAvailable.totalSize === file.size &&
        localMetaAvailable.lastModified === file.lastModified
      ) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error parsing localStorage data:", error);
      return false;
    }
  };

  const generateFileId = (file) => {
    const str = `${file.name}-${file.size}-${file.lastModified}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0; // Convert to 32-bit integer
    }
    return `file-${Math.abs(hash)}`;
  };

  const generateFileChunks = (file) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let chunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      try {
        const chunk = file.slice(start, end);
        chunks.push(chunk);
      } catch (error) {
        console.error("Error generating file chunks", error);
      }
    }
    return chunks;
  };

  const prepareSelectedFileForUpload = (file) => {
    const fid = generateFileId(file);
    const fileChunks = generateFileChunks(file);
    const isResumableFile = isResumable(file);

    setFileId(fid);
    setFileChunks(fileChunks);

    if (isResumableFile) {
      console.log("File is resumable, loading existing progress");

      const existingMeta = JSON.parse(localStorage.getItem(`upload-${fid}`));
      console.log("Resuming upload with chunks:", existingMeta.uploadedChunks);

      existingMeta.timestamp = Date.now();
      localStorage.setItem(`upload-${fid}`, JSON.stringify(existingMeta));
    } else {
      const uploadMeta = {
        fileId: fid,
        totalChunks: fileChunks.length,
        uploadedChunks: [],
        chunkSize: CHUNK_SIZE,
        fileName: file.name,
        lastModified: file.lastModified,
        totalSize: file.size,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        `upload-${uploadMeta.fileId}`,
        JSON.stringify(uploadMeta)
      );
    }
  };

  const handleFileSelect = (file) => {
    if (file.size === 0) {
      throw new Error("File is empty");
    }

    const isResumableFile = isResumable(file);

    setSelectedFile(file);
    setTotalBytes(file.size);

    if (hasExistingUpload && !isResumableFile) {
      console.log("Wrong file selected for existing upload");
      setUploadStatus("error");
      setErrorMessage(
        "Please select the same file that was originally uploaded to resume the upload."
      );
      return;
    }

    if (isResumableFile) {
      console.log("Resuming existing upload for file:", file.name);

      const fileChunks = generateFileChunks(file);
      setFileChunks(fileChunks);

      console.log("Chunks generated, ready to resume upload");
    } else {
      console.log("Starting new upload for file:", file.name);

      setUploadStatus("idle");
      setErrorMessage("");
      setBytesTransferred(0);
      setHasExistingUpload(false);

      prepareSelectedFileForUpload(file);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadStatus("idle");
    setErrorMessage("");
    setBytesTransferred(0);
    setTotalBytes(0);
    setFileId(undefined);
    setFileChunks([]);
    setHasExistingUpload(false);
    setAssemblyResult(null);

    const keys = Object.keys(localStorage);
    const uploadKeys = keys.filter((key) => key.startsWith("upload-"));
    uploadKeys.forEach((key) => localStorage.removeItem(key));
  };

  const handleRetry = () => {
    setUploadStatus("uploading");
    setErrorMessage("");

    if (selectedFile) {
      uploadFile(selectedFile);
    }
  };

  const handleStartNewUpload = () => {
    const currentFile = selectedFile;

    handleReset();

    setUploadStatus("idle");
    setErrorMessage("");
    setHasExistingUpload(false);

    if (currentFile) {
      setSelectedFile(currentFile);
      setTotalBytes(currentFile.size);
      prepareSelectedFileForUpload(currentFile);
    }
  };

  const handleStartUpload = () => {
    console.log("File Id ", fileId);
    uploadFile(selectedFile);
  };

  const handlePauseUpload = () => {
    setUploadStatus("paused");
    isPausedRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (fileId) {
      const uploadMetaData = JSON.parse(
        localStorage.getItem(`upload-${fileId}`)
      );
      if (uploadMetaData) {
        uploadMetaData.timestamp = Date.now();
        localStorage.setItem(
          `upload-${fileId}`,
          JSON.stringify(uploadMetaData)
        );
      }
    }
  };

  const handleResumeUpload = () => {
    setUploadStatus("uploading");
    isPausedRef.current = false;
    uploadProgressRef.current?.updateRetryStatus("");
    uploadFile(selectedFile);
  };

  const markChunkAsUploaded = (i) => {
    const uploadMetaData = JSON.parse(localStorage.getItem(`upload-${fileId}`));
    uploadMetaData.uploadedChunks.push(i);
    uploadMetaData.timestamp = Date.now(); // Update timestamp on each chunk upload
    localStorage.setItem(`upload-${fileId}`, JSON.stringify(uploadMetaData));
  };

  const triggerFileAssemble = async () => {
    try {
      console.log("Starting file assembly...");
      setUploadStatus("processing");
      setErrorMessage("");

      const response = await fetch(
        "http://localhost:3001/api/assemble-chunks",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Assembly failed: ${errorData.error || response.statusText}`
        );
      }

      const result = await response.json();
      console.log("File assembly completed successfully:", result);
      setAssemblyResult(result);
      setUploadStatus("completed");
      return result;
    } catch (error) {
      console.error("Assembly failed:", error);
      setUploadStatus("error");
      setErrorMessage(`File assembly failed: ${error.message}`);
      throw error;
    }
  };

  const uploadChunk = async (chunk, chunkIndex, retryCount = 0) => {
    const MAX_RETRIES = 5;
    const BASE_DELAY = 1000;

    const formData = new FormData();
    formData.append("chunkData", chunk);
    formData.append("fileId", fileId);
    formData.append("chunkIndex", chunkIndex);
    formData.append("totalChunks", fileChunks.length);
    formData.append("fileName", selectedFile.name);
    formData.append("totalSize", selectedFile.size);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const chunkBytes = chunk.size;
          const uploadedBytes = event.loaded;
          const progressPercentage = (uploadedBytes / chunkBytes) * 100;

          uploadProgressRef.current?.updateChunkProgress(
            chunkIndex,
            uploadedBytes,
            chunkBytes,
            progressPercentage
          );
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          markChunkAsUploaded(chunkIndex);
          uploadProgressRef.current?.markChunkComplete(chunkIndex, chunk.size);
          uploadProgressRef.current?.updateRetryStatus("");
          resolve(response);
        } else if (xhr.status >= 500) {
          reject(
            new Error(`Server error for chunk ${chunkIndex}: ${xhr.statusText}`)
          );
        } else {
          reject(new Error(`Chunk ${chunkIndex} failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error(`Network error for chunk ${chunkIndex}`));
      });

      xhr.addEventListener("abort", () => {
        reject(new Error(`Upload aborted for chunk ${chunkIndex}`));
      });

      xhr.addEventListener("timeout", () => {
        reject(new Error(`Timeout for chunk ${chunkIndex}`));
      });

      xhr.open("POST", "http://localhost:3001/api/upload-chunks");
      xhr.timeout = 30000;
      xhr.send(formData);

      abortControllerRef.current = xhr;
    }).catch(async (error) => {
      const isNetworkError =
        error.message.includes("Network error") ||
        error.message.includes("Timeout") ||
        error.message.includes("Failed to fetch");

      const isServerError = error.message.includes("Server error");

      const isRetryableError = isNetworkError && !isServerError;

      if (
        retryCount < MAX_RETRIES &&
        isRetryableError &&
        !error.message.includes("aborted")
      ) {
        const delay = BASE_DELAY * Math.pow(2, retryCount);
        const retryMessage = `Retrying chunk ${chunkIndex} in ${delay}ms (attempt ${
          retryCount + 1
        }/${MAX_RETRIES})`;
        console.log(retryMessage);

        uploadProgressRef.current?.updateRetryStatus(retryMessage);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return uploadChunk(chunk, chunkIndex, retryCount + 1);
      }

      uploadProgressRef.current?.updateRetryStatus("");

      if (retryCount >= MAX_RETRIES && isRetryableError) {
        throw new Error(
          `Chunk ${chunkIndex} failed after ${MAX_RETRIES} retries. You can manually resume the upload.`
        );
      }

      throw error;
    });
  };

  const uploadFile = async () => {
    setUploadStatus("uploading");
    isPausedRef.current = false;
    abortControllerRef.current = null;

    uploadProgressRef.current?.updateRetryStatus("");

    const progressInterval = uploadProgressRef.current?.startProgressPolling();

    try {
      const uploadMetaData = JSON.parse(
        localStorage.getItem(`upload-${fileId}`)
      );
      const uploadedChunks = uploadMetaData.uploadedChunks || [];

      console.log(
        `Resuming upload from chunk ${uploadedChunks.length} of ${fileChunks.length}`
      );

      if (uploadedChunks.length >= fileChunks.length) {
        console.log("All chunks already uploaded, triggering assembly");
        await triggerFileAssemble();
        // triggerFileAssemble handles status internally
        clearInterval(progressInterval);
        return;
      }

      if (!selectedFile || selectedFile.size === 0) {
        setUploadStatus("error");
        setErrorMessage(
          "Please select the original file to resume the upload."
        );
        clearInterval(progressInterval);
        return;
      }

      const fileIdFromFile = generateFileId(selectedFile);
      if (fileIdFromFile !== fileId) {
        setUploadStatus("error");
        setErrorMessage(
          "Please select the same file that was originally uploaded."
        );
        clearInterval(progressInterval);
        return;
      }

      for (let i = uploadedChunks.length; i < fileChunks.length; i++) {
        // Check if upload was paused
        if (isPausedRef.current) {
          console.log("Upload paused at chunk", i);
          clearInterval(progressInterval);
          return;
        }

        const chunk = fileChunks[i];
        try {
          const response = await uploadChunk(chunk, i);
          console.log("Chunk uploaded successfully", response);

          if (response.isComplete) {
            console.log("File upload complete");
            await triggerFileAssemble();
            // triggerFileAssemble handles status internally
            clearInterval(progressInterval);
            break;
          }
        } catch (error) {
          if (error.message.includes("aborted")) {
            console.log("Upload aborted, stopping at chunk", i);
            clearInterval(progressInterval);
            return;
          }

          if (
            error.message.includes("failed after") &&
            error.message.includes("retries")
          ) {
            console.log("Retries exhausted, allowing manual resume");
            clearInterval(progressInterval);
            setUploadStatus("paused");
            setErrorMessage(error.message);
            return;
          }

          throw error;
        }
      }
    } catch (error) {
      clearInterval(progressInterval);
      if (!error.message.includes("aborted")) {
        setUploadStatus("error");
        setErrorMessage(`Upload failed: ${error.message}`);
      }
    }
  };

  const handleProgressUpdate = (
    uploadedBytes,
    totalBytes,
    progressPercentage
  ) => {
    setBytesTransferred(uploadedBytes);
    setTotalBytes(totalBytes);

    if (progressPercentage >= 100) {
      setUploadStatus("completed");
    }
  };

  return {
    selectedFile,
    uploadStatus,
    errorMessage,
    bytesTransferred,
    totalBytes,
    fileId,
    fileChunks,
    CHUNK_SIZE,
    hasExistingUpload,
    uploadProgressRef,
    handleFileSelect,
    handleReset,
    handleRetry,
    handleStartUpload,
    handlePauseUpload,
    handleResumeUpload,
    handleProgressUpdate,
    setUploadStatus,
    setErrorMessage,
    setSelectedFile,
    handleStartNewUpload,
    assemblyResult,
  };
};
