import React, { useState } from "react";
import FileInput from "./FileInput.jsx";
import Progress from "./Progress.jsx";
import Button from "./Button.jsx";

function SimpleUploader({ onUploadComplete, onUploadError }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, uploading, completed, error
  const [resetFileInput, setResetFileInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [bytesTransferred, setBytesTransferred] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setUploadStatus("idle");
    setErrorMessage("");
    setBytesTransferred(0);
    setTotalBytes(file.size);
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setBytesTransferred(event.loaded);
          setTotalBytes(event.total);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          setUploadStatus("completed");
          setBytesTransferred(file.size);
          onUploadComplete?.(file, xhr.response);
        } else {
          setUploadStatus("error");
          setErrorMessage(`Upload failed: ${xhr.statusText}`);
          onUploadError?.(file, xhr.statusText);
        }
      });

      xhr.addEventListener("error", () => {
        setUploadStatus("error");
        setErrorMessage("Network error occurred");
        onUploadError?.(file, "Network error occurred");
      });

      xhr.addEventListener("timeout", () => {
        setUploadStatus("error");
        setErrorMessage("Upload timed out");
        onUploadError?.(file, "Upload timed out");
      });

      xhr.open("POST", "http://localhost:3001/api/upload");
      xhr.timeout = 3000000; // 50 minutes
      xhr.send(formData);
    } catch (error) {
      setUploadStatus("error");
      setErrorMessage(`Upload failed: ${error.message}`);
      onUploadError?.(file, error.message);
    }
  };

  const handleStartUpload = () => {
    if (!selectedFile) return;

    setUploadStatus("uploading");
    setErrorMessage("");
    setBytesTransferred(0);

    uploadFile(selectedFile);
  };

  const handlePauseUpload = () => {
    setUploadStatus("paused");
  };

  const handleResumeUpload = () => {
    setUploadStatus("uploading");
    uploadFile(selectedFile);
  };

  const handleReset = () => {
    setUploadStatus("idle");
    setSelectedFile(null);
    setErrorMessage("");
    setBytesTransferred(0);
    setTotalBytes(0);
    setResetFileInput(true);

    setTimeout(() => setResetFileInput(false), 100);
  };

  return (
    <div className="upload-form">
      {uploadStatus === "idle" && (
        <FileInput
          onFileSelect={handleFileSelect}
          label="Choose File to Upload"
          accept="*/*"
          reset={resetFileInput}
        />
      )}

      {selectedFile && (
        <div className="upload-controls">
          {uploadStatus === "idle" && (
            <div className="button-group">
              <Button
                label="Start Upload"
                variant="success"
                onClick={handleStartUpload}
              />
            </div>
          )}

          {(uploadStatus === "uploading" || uploadStatus === "paused") && (
            <div className="upload-progress-section">
              <div className="upload-filename">
                {selectedFile.name}{" "}
                {uploadStatus === "uploading" && "(uploading...)"}
              </div>
              <div className="progress-with-controls">
                <Progress
                  currentBytes={bytesTransferred}
                  totalBytes={totalBytes}
                />
                {uploadStatus === "uploading" && (
                  <Button
                    label="Pause"
                    variant="warning"
                    onClick={handlePauseUpload}
                  />
                )}
                {uploadStatus === "paused" && (
                  <Button
                    label="Resume"
                    variant="primary"
                    onClick={handleResumeUpload}
                  />
                )}
              </div>
            </div>
          )}

          {uploadStatus === "completed" && (
            <div className="upload-completed">
              <div className="upload-success">
                Upload completed successfully!
              </div>
              <div className="button-group">
                <Button
                  label="Upload New File"
                  variant="primary"
                  onClick={handleReset}
                />
              </div>
            </div>
          )}

          {uploadStatus === "error" && (
            <div className="upload-error">{errorMessage}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default SimpleUploader;
