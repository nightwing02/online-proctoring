import React, { useState, useEffect } from 'react';
import './App.css';
import CalibrationPanel from './components/CalibrationPanel';
import MonitoringPanel from './components/MonitoringPanel';
import StatusPanel from './components/StatusPanel';

const API_URL = 'http://localhost:5000'; // Change this to your backend URL if different

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [calibrated, setCalibrated] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState(0);
  const [totalCalibrationSteps, setTotalCalibrationSteps] = useState(5);
  const [calibrationInstructions, setCalibrationInstructions] = useState([]);
  const [mode, setMode] = useState('setup'); // 'setup', 'calibration', 'monitoring'
  const [messages, setMessages] = useState([]);
  const [cheatingDetected, setCheatingDetected] = useState(false);

  // Check connection to backend
  useEffect(() => {
    // First check both connection and detector status
    const initialCheck = async () => {
      await checkConnection();
      await checkDetectorStatus();
    };
    
    initialCheck();
    
    // Check connection every 5 seconds
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      const newConnectionStatus = data.status === 'ok';
      
      // If connection status changed from false to true, check detector status
      if (!isConnected && newConnectionStatus) {
        checkDetectorStatus();
      }
      
      setIsConnected(newConnectionStatus);
    } catch (error) {
      console.error('Failed to connect to backend:', error);
      setIsConnected(false);
    }
  };

  const checkDetectorStatus = async () => {
    try {
      console.log("Checking detector status...");
      const response = await fetch(`${API_URL}/status`);
      const data = await response.json();
      console.log("Detector status:", data);
      setCalibrated(data.calibrated);
      if (data.calibrated) {
        setCalibrationStep("complete");
        // If already calibrated, switch to monitoring mode
        if (mode === 'setup') {
          setMode('monitoring');
          setMessages(prev => [...prev, 'System already calibrated. Starting monitoring...']);
        }
      } else if (data.calibration_step !== undefined) {
        setCalibrationStep(data.calibration_step);
      }
    } catch (error) {
      console.error('Failed to check detector status:', error);
    }
  };

  const startCalibration = async () => {
    try {
      const response = await fetch(`${API_URL}/calibration/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log("Calibration start response:", data);
      if (data.status === 'calibration_started') {
        setCalibrationStep(data.current_step);
        setTotalCalibrationSteps(data.total_steps);
        setCalibrationInstructions(data.steps);
        setMode('calibration');
        setMessages(['Calibration started. Follow the instructions.']);
      } else {
        setMessages(['Failed to start calibration']);
      }
    } catch (error) {
      console.error('Error starting calibration:', error);
      setMessages(['Error: Failed to start calibration']);
    }
  };

  const processCalibrationStep = async (imageData) => {
    try {
      const response = await fetch(`${API_URL}/calibration/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });
      
      const data = await response.json();
      console.log("Calibration step response:", data);
      
      if (data.status === 'calibration_complete') {
        setCalibrated(true);
        setCalibrationStep('complete');
        setMessages(prev => [...prev, 'Calibration complete! Ready for monitoring.']);
        // Add a small delay before switching to monitoring to ensure everything is ready
        setTimeout(() => {
          setMode('monitoring');
        }, 1000);
      } else if (data.status === 'calibration_in_progress') {
        setCalibrationStep(data.current_step);
        setMessages(prev => [...prev, `Step ${data.current_step} of ${data.total_steps} completed.`]);
      } else if (data.status === 'error') {
        setMessages(prev => [...prev, `Error: ${data.message}`]);
      }
    } catch (error) {
      console.error('Error during calibration step:', error);
      setMessages(prev => [...prev, 'Error: Failed to process calibration step']);
    }
  };

  const analyzeFrame = async (imageData) => {
    if (!imageData) {
      console.error("No image data provided to analyzeFrame");
      return null;
    }
    
    try {
      console.log("Sending frame for analysis...");
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      });
      
      const data = await response.json();
      console.log("Frame analysis response:", data.status);
      
      if (data.status === 'ok') {
        setCheatingDetected(data.cheating_detected);
        setMessages(data.messages);
        return data.frame; // Return processed frame with annotations
      } else if (data.status === 'no_face') {
        setMessages(['No face detected']);
        return data.frame;
      } else {
        console.error("Error analyzing frame:", data.message);
        setMessages([`Error: ${data.message}`]);
        return null;
      }
    } catch (error) {
      console.error('Error analyzing frame:', error);
      setMessages(['Error: Failed to analyze frame']);
      return null;
    }
  };

  const handleNextStep = (imageData) => {
    processCalibrationStep(imageData);
  };

  const switchToCalibration = () => {
    startCalibration();
  };

  const switchToMonitoring = () => {
    if (calibrated) {
      setMode('monitoring');
      setMessages(prev => [...prev, 'Switching to monitoring mode']);
    } else {
      setMessages(['Please complete calibration before monitoring']);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Exam Proctoring System</h1>
        <StatusPanel 
          isConnected={isConnected} 
          calibrated={calibrated} 
          mode={mode}
          cheatingDetected={cheatingDetected}
        />
      </header>
      
      <div className="app-content">
        {mode === 'setup' && (
          <div className="setup-panel">
            <h2>Setup</h2>
            <p>Before starting the exam monitoring, you need to calibrate the system.</p>
            <div className="setup-buttons">
              <button 
                className="primary-button"
                onClick={switchToCalibration}
                disabled={!isConnected}
              >
                Start Calibration
              </button>
              <button 
                className="secondary-button"
                onClick={switchToMonitoring}
                disabled={!isConnected || !calibrated}
              >
                Skip to Monitoring
              </button>
            </div>
          </div>
        )}
        
        {mode === 'calibration' && (
          <CalibrationPanel 
            step={calibrationStep}
            totalSteps={totalCalibrationSteps}
            instructions={calibrationInstructions}
            onNextStep={handleNextStep}
          />
        )}
        
        {mode === 'monitoring' && (
          <MonitoringPanel 
            onAnalyzeFrame={analyzeFrame}
            cheatingDetected={cheatingDetected}
          />
        )}
      </div>
      
      <div className="message-panel">
        <h3>System Messages</h3>
        <div className="message-container">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={message.includes("ALERT") ? "message alert" : "message"}
            >
              {message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;