import React from "react";
import FileInput from "./FileInput.jsx";
import Button from "./Button.jsx";
import UploadProgress from "./UploadProgress.jsx";
import { useResumableUpload } from "../hooks/useResumableUpload.js";

function ResumableUploader() {
  const {
    selectedFile,
    uploadStatus,
    errorMessage,
    fileId,
    fileChunks,
    uploadProgressRef,
    handleFileSelect,
    handleReset,
    handleStartUpload,
    handlePauseUpload,
    handleResumeUpload,
    handleProgressUpdate,
  } = useResumableUpload();

  return (
    <div className="upload-form">
      {uploadStatus === "idle" && (
        <FileInput
          onFileSelect={handleFileSelect}
          label="Choose File to Upload"
          accept="*/*"
          reset={false}
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

          <UploadProgress
            ref={uploadProgressRef}
            fileId={fileId}
            selectedFile={selectedFile}
            fileChunks={fileChunks}
            uploadStatus={uploadStatus}
            onProgressUpdate={handleProgressUpdate}
            onPause={handlePauseUpload}
            onResume={handleResumeUpload}
          />

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

export default ResumableUploader;
