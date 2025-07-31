import React from "react";

function Progress({ totalBytes, currentBytes }) {
  const percentage =
    totalBytes > 0 ? Math.round((currentBytes / totalBytes) * 100) : 0;

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="progress-container">
      <div className="progress-header">
        <span className="progress-title">{percentage}%</span>
        {totalBytes && currentBytes && (
          <span className="progress-bytes">
            {formatBytes(currentBytes)} / {formatBytes(totalBytes)}
          </span>
        )}
      </div>
      <div className="progress">
        <div className="progress-bar" style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

export default Progress;
