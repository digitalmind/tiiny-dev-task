import React, { useState } from "react";
import FileInput from "./FileInput.jsx";
import Progress from "./Progress.jsx";
import Button from "./Button.jsx";

function ResumableUploader() {
  const CHUNK_SIZE = 1 * 1024 * 1024; // Let's start with a 1mb

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, uploading, completed, error
  const [resetFileInput, setResetFileInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [bytesTransferred, setBytesTransferred] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [fileId, setFileId] = useState();
  const [fileChunks, setFileChunks] = useState([]);

  const isResumable = (file) => {
    const fid = generateFileId(file);
    const rawLocalMetaAvailable = localStorage.getItem(`upload-${fid}`);
    console.log(rawLocalMetaAvailable);
    // if (!localMetaAvailable) {
    //   return false;
    // }
    // if (
    //   localMetaAvailable.uploadedChunks.length ===
    //   localMetaAvailable.totalChunks
    // ) {
    //   return false;
    // }
    // return true;
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
    if (isResumable(file)) {
      console.log("File is resumable");
    }
    const fid = generateFileId(file);
    const fileChunks = generateFileChunks(file);

    setFileId(fid);
    setFileChunks(fileChunks);
    const uploadMeta = {
      fileId: fid,
      totalChunks: fileChunks.length,
      uploadedChunks: [],
      chunkSize: CHUNK_SIZE,
      fileName: file.name,
      lastModified: file.lastModified,
    };
    localStorage.setItem(
      `upload-${uploadMeta.fileId}`,
      JSON.stringify(uploadMeta)
    );
  };

  const handleFileSelect = (file) => {
    if (file.size === 0) {
      throw new Error("File is empty");
    }
    setSelectedFile(file);
    setUploadStatus("idle");
    setErrorMessage("");
    setBytesTransferred(0);
    setTotalBytes(file.size);
    prepareSelectedFileForUpload(file);
  };

  const handleReset = () => {
    // localStorage.removeItem(`upload-${fileId}`);
  };

  const handleStartUpload = () => {
    console.log("File Id ", fileId);
    uploadFile(selectedFile);
  };

  const handlePauseUpload = () => {};

  const handleResumeUpload = () => {};

  const markChunkAsUploaded = (i) => {
    const uploadMetaData = JSON.parse(localStorage.getItem(`upload-${fileId}`));
    uploadMetaData.uploadedChunks.push(i);
    localStorage.setItem(`upload-${fileId}`, JSON.stringify(uploadMetaData));
  };
  const triggerFileAssemble = async () => {
    try {
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
        throw new Error(`Assembly failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("File assembled successfully", result);
      return result;
    } catch (error) {
      console.error("Assembly failed:", error);
      throw error;
    }
  };

  const uploadChunk = async (chunk, chunkIndex) => {
    const formData = new FormData();
    formData.append("chunkData", chunk);
    formData.append("fileId", fileId);
    formData.append("chunkIndex", chunkIndex);
    formData.append("totalChunks", fileChunks.length);
    formData.append("fileName", selectedFile.name);
    formData.append("totalSize", selectedFile.size);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          markChunkAsUploaded(chunkIndex);
          resolve(response);
        } else {
          reject(new Error(`Chunk ${chunkIndex} failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error(`Network error for chunk ${chunkIndex}`));
      });

      xhr.open("POST", "http://localhost:3001/api/upload-chunks");
      xhr.timeout = 30000;
      xhr.send(formData);
    });
  };

  const uploadFile = async () => {
    setUploadStatus("uploading");
    for (let i = 0; i < fileChunks.length; i++) {
      const chunk = fileChunks[i];
      const response = await uploadChunk(chunk, i);
      console.log("Chunk uploaded successfully", response);
      if (response.isComplete) {
        console.log("File upload complete");
        await triggerFileAssemble();
        setUploadStatus("completed");
      }
    }
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

export default ResumableUploader;
