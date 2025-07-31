import "./App.css";
import Card from "./components/Card.jsx";
import ResumableUploader from "./components/ResumableUploader.jsx";
import SimpleUploader from "./components/SimpleUploader.jsx";

function App() {
  const handleUploadComplete = (file, response) => {
    console.log("Upload completed:", file.name, response);
  };

  const handleUploadError = (file, error) => {
    console.error("Upload failed:", file.name, error);
  };

  return (
    <>
      <div className="app-container">
        <h3>File Uploader</h3>
        <Card>
          <ResumableUploader
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </Card>
      </div>
    </>
  );
}

export default App;
