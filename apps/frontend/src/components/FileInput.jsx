import React, { useState, useEffect } from "react";

function FileInput({ onFileSelect, accept, label = "Choose File", reset = false }) {
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (reset) {
      setSelectedFile(null);
    }
  }, [reset]);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      onFileSelect?.(file);
    }
  };

  return (
    <div className="file-input-simple">
      <label className="file-input-label">
        {label}
        <input
          type="file"
          onChange={handleChange}
          accept={accept}
          className="file-input"
        />
      </label>
      {selectedFile && (
        <div className="file-selected">
          <span className="file-name">{selectedFile.name}</span>
        </div>
      )}
    </div>
  );
}

export default FileInput;
