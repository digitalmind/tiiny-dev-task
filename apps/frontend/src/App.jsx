import "./App.css";
import { useState } from "react";
import Card from "./components/Card.jsx";
import FileInput from "./components/FileInput.jsx";
import Progress from "./components/Progress.jsx";
import Button from "./components/Button.jsx";

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle, uploading, completed, error
  const [resetFileInput, setResetFileInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setUploadStatus("idle");
    setUploadProgress(0);
    setErrorMessage("");
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });

      // Handle response
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          setUploadStatus("completed");
          setUploadProgress(100);
        } else {
          setUploadStatus("error");
          setErrorMessage(`Upload failed: ${xhr.statusText}`);
        }
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        setUploadStatus("error");
        setErrorMessage("Network error occurred");
      });

      // Handle timeout
      xhr.addEventListener("timeout", () => {
        setUploadStatus("error");
        setErrorMessage("Upload timed out");
      });

      xhr.open("POST", "http://localhost:3001/api/upload");
      xhr.timeout = 3000000; // 3000000 milliseconds = 3000 seconds = 50 minutes
      xhr.send(formData);
    } catch (error) {
      setUploadStatus("error");
      setErrorMessage(`Upload failed: ${error.message}`);
    }
  };

  const handleStartUpload = () => {
    if (!selectedFile) return;

    setUploadStatus("uploading");
    setUploadProgress(0);
    setErrorMessage("");

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
    setUploadProgress(0);
    setErrorMessage("");
    setResetFileInput(true);
    // Reset the flag after a short delay
    setTimeout(() => setResetFileInput(false), 100);
  };

  return (
    <>
      <div>
        <h3>File Upload Form</h3>
        <Card>
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="upload-form">
              <FileInput
                onFileSelect={handleFileSelect}
                label="Choose File to Upload"
                accept="*/*"
                reset={resetFileInput}
              />

              {selectedFile && (
                <div className="upload-controls">
                  <div className="button-group">
                    {uploadStatus === "idle" && (
                      <Button
                        label="Start Upload"
                        variant="success"
                        onClick={handleStartUpload}
                      />
                    )}

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

                    {uploadStatus === "completed" && (
                      <Button
                        label="Upload New File"
                        variant="primary"
                        onClick={handleReset}
                      />
                    )}
                  </div>

                  {(uploadStatus === "uploading" ||
                    uploadStatus === "paused") && (
                    <Progress current={uploadProgress} total={100} />
                  )}

                  {uploadStatus === "completed" && (
                    <div className="upload-success">
                      Upload completed successfully!
                    </div>
                  )}

                  {uploadStatus === "error" && (
                    <div className="upload-error">❌ {errorMessage}</div>
                  )}
                </div>
              )}
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

export default App;
