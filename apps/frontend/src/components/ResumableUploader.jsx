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
    hasExistingUpload,
    uploadProgressRef,
    handleFileSelect,
    handleReset,
    handleRetry,
    handleStartNewUpload,
    handleStartUpload,
    handlePauseUpload,
    handleResumeUpload,
    handleProgressUpdate,
    setUploadStatus,
    setErrorMessage,
    setSelectedFile,
  } = useResumableUpload();

  // Show resume button when we have an existing upload and the correct file is selected
  const canResume = hasExistingUpload && selectedFile && fileChunks.length > 0;

  return (
    <div className="upload-form">
      {uploadStatus === "idle" && (
        <FileInput
          onFileSelect={handleFileSelect}
          label={
            hasExistingUpload
              ? "Select the same file to resume upload"
              : "Choose File to Upload"
          }
          accept="*/*"
          reset={false}
        />
      )}

      {hasExistingUpload && uploadStatus === "idle" && !selectedFile && (
        <div className="existing-upload-notice">
          <p>
            📁 Found an existing upload. Please select the same file to resume.
          </p>
        </div>
      )}

      {(selectedFile || hasExistingUpload) && (
        <div className="upload-controls">
          {uploadStatus === "idle" && (
            <div className="button-group">
              <Button
                label={canResume ? "Resume Upload" : "Start Upload"}
                variant="success"
                onClick={handleStartUpload}
                disabled={hasExistingUpload && !selectedFile}
              />
            </div>
          )}

          {(uploadStatus === "uploading" || uploadStatus === "paused") && (
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
            <div className="upload-error">
              <div>{errorMessage}</div>
              <div className="button-group">
                {hasExistingUpload ? (
                  <>
                    <Button
                      label="Select Correct File"
                      variant="primary"
                      onClick={() => {
                        setUploadStatus("idle");
                        setErrorMessage("");
                        setSelectedFile(null);
                      }}
                    />
                    <Button
                      label="Start New Upload"
                      variant="danger"
                      onClick={handleStartNewUpload}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      label="Try Again"
                      variant="primary"
                      onClick={handleRetry}
                    />
                    <Button
                      label="Start Over"
                      variant="danger"
                      onClick={handleReset}
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ResumableUploader;
