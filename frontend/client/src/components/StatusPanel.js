import React from 'react';

function StatusPanel({ isConnected, calibrated, mode, cheatingDetected }) {
  return (
    <div className="status-panel">
      <div className="status-row">
        <div className="status-indicator">
          <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        
        <div className="status-indicator">
          <div className={`status-dot ${calibrated ? 'calibrated' : 'not-calibrated'}`}></div>
          <span>{calibrated ? 'Calibrated' : 'Not Calibrated'}</span>
        </div>
        
        {mode === 'monitoring' && (
          <div className="status-indicator">
            <div className={`status-dot ${cheatingDetected ? 'cheating' : 'connected'}`}></div>
            <span>{cheatingDetected ? 'CHEATING DETECTED!' : 'No Cheating'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatusPanel;