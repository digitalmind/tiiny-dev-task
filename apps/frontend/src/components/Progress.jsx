import React from "react";

function Progress({ total, current }) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="progress-container">
      <div className="progress-header">
        <span className="progress-title">
          {current} / {total}
        </span>
        <span className="progress-percentage">{percentage}%</span>
      </div>
      <div className="progress">
        <div className="progress-bar" style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

export default Progress;
