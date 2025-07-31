import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import Progress from "./Progress.jsx";

const UploadProgress = forwardRef(
  (
    {
      fileId,
      selectedFile,
      fileChunks,
      uploadStatus,
      onProgressUpdate,
      onPause,
      onResume,
    },
    ref
  ) => {
    const [chunkProgress, setChunkProgress] = useState({});
    const [bytesTransferred, setBytesTransferred] = useState(0);
    const [totalBytes, setTotalBytes] = useState(0);

    const calculateProgressFromChunks = (uploadedChunks) => {
      let completedChunksBytes = 0;
      for (let i = 0; i < uploadedChunks.length; i++) {
        if (fileChunks[i]) {
          completedChunksBytes += fileChunks[i].size;
        }
      }

      let currentChunkBytes = 0;
      if (uploadedChunks.length < fileChunks.length) {
        const currentChunkIndex = uploadedChunks.length;
        const currentChunkProgress = chunkProgress[currentChunkIndex];
        if (currentChunkProgress && currentChunkProgress.uploaded > 0) {
          currentChunkBytes = currentChunkProgress.uploaded;
        }
      }

      const totalUploadedBytes = completedChunksBytes + currentChunkBytes;
      const totalBytes = selectedFile.size;
      const progressPercentage = (totalUploadedBytes / totalBytes) * 100;

      return {
        uploadedBytes: Math.min(totalUploadedBytes, totalBytes),
        totalBytes,
        progressPercentage: Math.min(progressPercentage, 100),
      };
    };

    const updateProgress = () => {
      const storedData = localStorage.getItem(`upload-${fileId}`);
      if (storedData) {
        const { uploadedChunks = [] } = JSON.parse(storedData);
        const { uploadedBytes, totalBytes, progressPercentage } =
          calculateProgressFromChunks(uploadedChunks);

        setBytesTransferred(uploadedBytes);
        setTotalBytes(totalBytes);

        return { progressPercentage, uploadedChunks: uploadedChunks.length };
      }
      return null;
    };

    useEffect(() => {
      if (fileId && selectedFile) {
        const storedData = localStorage.getItem(`upload-${fileId}`);
        if (storedData) {
          const { uploadedChunks = [] } = JSON.parse(storedData);
          const { uploadedBytes, totalBytes, progressPercentage } =
            calculateProgressFromChunks(uploadedChunks);

          if (
            uploadedBytes >= 0 &&
            totalBytes > 0 &&
            uploadedBytes <= totalBytes
          ) {
            setBytesTransferred(uploadedBytes);
            setTotalBytes(totalBytes);

            onProgressUpdate?.(uploadedBytes, totalBytes, progressPercentage);
          }
        }
      }
    }, [chunkProgress, fileId, selectedFile, onProgressUpdate]);

    const startProgressPolling = () => {
      const progressInterval = setInterval(() => {
        if (uploadStatus === "completed" || uploadStatus === "error") {
          clearInterval(progressInterval);
          return;
        }

        const progressData = updateProgress();
        if (progressData && progressData.progressPercentage >= 100) {
          clearInterval(progressInterval);
          onProgressUpdate?.(totalBytes, totalBytes, 100);
        }
      }, 1000);

      return progressInterval;
    };

    const updateChunkProgress = (chunkIndex, uploaded, total, percentage) => {
      setChunkProgress((prev) => ({
        ...prev,
        [chunkIndex]: {
          uploaded,
          total,
          percentage,
        },
      }));
    };

    const markChunkComplete = (chunkIndex, chunkSize) => {
      setChunkProgress((prev) => ({
        ...prev,
        [chunkIndex]: {
          uploaded: chunkSize,
          total: chunkSize,
          percentage: 100,
        },
      }));
    };

    useImperativeHandle(ref, () => ({
      bytesTransferred,
      totalBytes,
      startProgressPolling,
      updateChunkProgress,
      markChunkComplete,
    }));

    if (uploadStatus !== "uploading" && uploadStatus !== "paused") {
      return null;
    }

    return (
      <div className="upload-progress-section">
        <div className="upload-filename">
          {selectedFile.name} {uploadStatus === "uploading" && "(uploading...)"}
        </div>
        <div className="progress-with-controls">
          <Progress currentBytes={bytesTransferred} totalBytes={totalBytes} />
          {uploadStatus === "uploading" && onPause && (
            <button className="btn btn-warning" onClick={onPause}>
              <span className="btn-icon">⏸️</span>
              <span className="btn-label">Pause</span>
            </button>
          )}
          {uploadStatus === "paused" && onResume && (
            <button className="btn btn-primary" onClick={onResume}>
              <span className="btn-icon">▶️</span>
              <span className="btn-label">Resume</span>
            </button>
          )}
        </div>
      </div>
    );
  }
);

export default UploadProgress;
