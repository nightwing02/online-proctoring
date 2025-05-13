// import React, { useState, useEffect, useRef } from 'react';
// import './MonitoringPanel.css';

// function MonitoringPanel({ onAnalyzeFrame, cheatingDetected }) {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const analysisIntervalRef = useRef(null);
//   const [stream, setStream] = useState(null);
//   const [isRunning, setIsRunning] = useState(false);
//   const [displayImage, setDisplayImage] = useState(null);
//   const [cameraReady, setCameraReady] = useState(false);
  
//   // Start camera when component mounts
//   useEffect(() => {
//     startCamera();
    
//     return () => {
//       stopMonitoring();
//       if (stream) {
//         stream.getTracks().forEach(track => track.stop());
//       }
//     };
//   }, []);
  
//   const startCamera = async () => {
//     try {
//       console.log("Starting camera...");
//       const constraints = {
//         video: {
//           width: { ideal: 640 },
//           height: { ideal: 480 },
//           facingMode: 'user'
//         }
//       };
      
//       const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
//       setStream(mediaStream);
      
//       if (videoRef.current) {
//         videoRef.current.srcObject = mediaStream;
//         // Wait for video to be ready
//         videoRef.current.onloadedmetadata = () => {
//           setCameraReady(true);
//           console.log("Camera is ready");
//         };
//       }
//     } catch (error) {
//       console.error('Error accessing camera:', error);
//       alert('Failed to access camera. Please ensure your camera is connected and you have granted permission.');
//     }
//   };
  
//   const startMonitoring = () => {
//     console.log("Starting monitoring...");
//     console.log("Camera ready:", cameraReady);
//     console.log("Video ref exists:", !!videoRef.current);
    
//     if (!isRunning && videoRef.current && cameraReady) {
//       console.log("Monitoring started");
//       setIsRunning(true);
      
//       // Start sending frames at regular intervals (e.g., every 500ms)
//       analysisIntervalRef.current = setInterval(async () => {
//         const imageData = captureImage();
//         if (imageData) {
//           console.log("Frame captured, sending for analysis");
//           try {
//             const processedImage = await onAnalyzeFrame(imageData);
//             if (processedImage) {
//               setDisplayImage(processedImage);
//             }
//           } catch (error) {
//             console.error("Error analyzing frame:", error);
//           }
//         } else {
//           console.log("Failed to capture frame");
//         }
//       }, 500);
//     } else {
//       console.log("Cannot start monitoring. Prerequisites not met.");
//       console.log("isRunning:", isRunning);
//       console.log("videoRef.current:", !!videoRef.current);
//       console.log("cameraReady:", cameraReady);
      
//       // Try to start the camera again if needed
//       if (!videoRef.current || !cameraReady) {
//         startCamera();
//       }
//     }
//   };
  
//   const stopMonitoring = () => {
//     console.log("Stopping monitoring");
//     if (analysisIntervalRef.current) {
//       clearInterval(analysisIntervalRef.current);
//       analysisIntervalRef.current = null;
//     }
//     setIsRunning(false);
//   };
  
//   const captureImage = () => {
//     const video = videoRef.current;
//     const canvas = canvasRef.current;
    
//     if (video && canvas && video.readyState === 4) { // 4 = HAVE_ENOUGH_DATA
//       const context = canvas.getContext('2d');
//       canvas.width = video.videoWidth;
//       canvas.height = video.videoHeight;
//       context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
//       const imageData = canvas.toDataURL('image/jpeg');
//       return imageData;
//     }
//     return null;
//   };
  
//   // Auto-start monitoring when the camera is ready
//   useEffect(() => {
//     if (cameraReady) {
//       console.log("Camera is ready, starting monitoring");
//       const timer = setTimeout(() => {
//         startMonitoring();
//       }, 1000); // Short delay to ensure camera is initialized
      
//       return () => clearTimeout(timer);
//     }
//   }, [cameraReady]);
  
//   return (
//     <div className={`monitoring-panel ${cheatingDetected ? 'cheating-detected' : ''}`}>
//       <h2>Exam Monitoring</h2>
      
//       <div className="monitoring-content">
//         <div className="camera-container">
//           {/* Video element for capturing camera input - Made visible to help troubleshoot */}
//           <video 
//             ref={videoRef}
//             autoPlay
//             playsInline
//             muted
//             className="camera-feed"
//           ></video>
          
//           {/* Canvas for capturing frames */}
//           <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          
//           {/* Display the processed image from backend */}
//           {displayImage ? (
//             <img 
//               src={displayImage} 
//               alt="Processed feed" 
//               className="processed-feed" 
//             />
//           ) : (
//             <div className="loading-feed">
//               <p>Starting camera...</p>
//             </div>
//           )}
          
//           {cheatingDetected && (
//             <div className="cheating-alert">
//               <span className="alert-icon">⚠️</span>
//               <span>CHEATING DETECTED!</span>
//             </div>
//           )}
//         </div>
        
//         <div className="monitoring-controls">
//           {isRunning ? (
//             <button 
//               className="secondary-button"
//               onClick={stopMonitoring}
//             >
//               Pause Monitoring
//             </button>
//           ) : (
//             <button 
//               className="primary-button"
//               onClick={startMonitoring}
//               disabled={!cameraReady}
//             >
//               Resume Monitoring
//             </button>
//           )}
//           <div className="status-text">
//             {cameraReady ? (isRunning ? 'Monitoring active' : 'Monitoring paused') : 'Initializing camera...'}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default MonitoringPanel;


import React, { useState, useEffect, useRef } from 'react';
import './MonitoringPanel.css';

function MonitoringPanel({ onAnalyzeFrame, cheatingDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const analysisIntervalRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [displayImage, setDisplayImage] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  // Start camera when component mounts
  useEffect(() => {
    startCamera();
    
    return () => {
      stopMonitoring();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const startCamera = async () => {
    try {
      console.log("Starting camera...");
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          setCameraReady(true);
          console.log("Camera is ready");
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Failed to access camera. Please ensure your camera is connected and you have granted permission.');
    }
  };
  
  const startMonitoring = () => {
    console.log("Starting monitoring...");
    console.log("Camera ready:", cameraReady);
    console.log("Video ref exists:", !!videoRef.current);
    
    if (!isRunning && videoRef.current && cameraReady) {
      console.log("Monitoring started");
      setIsRunning(true);
      
      // Start sending frames at regular intervals (e.g., every 500ms)
      analysisIntervalRef.current = setInterval(async () => {
        const imageData = captureImage();
        if (imageData) {
          console.log("Frame captured, sending for analysis");
          try {
            const processedImage = await onAnalyzeFrame(imageData);
            if (processedImage) {
              setDisplayImage(processedImage);
            }
          } catch (error) {
            console.error("Error analyzing frame:", error);
          }
        } else {
          console.log("Failed to capture frame");
        }
      }, 500);
    } else {
      console.log("Cannot start monitoring. Prerequisites not met.");
      console.log("isRunning:", isRunning);
      console.log("videoRef.current:", !!videoRef.current);
      console.log("cameraReady:", cameraReady);
      
      // Try to start the camera again if needed
      if (!videoRef.current || !cameraReady) {
        startCamera();
      }
    }
  };
  
  const stopMonitoring = () => {
    console.log("Stopping monitoring");
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    setIsRunning(false);
  };
  
  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas && video.readyState === 4) { // 4 = HAVE_ENOUGH_DATA
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg');
      return imageData;
    }
    return null;
  };
  
  // Auto-start monitoring when the camera is ready
  useEffect(() => {
    if (cameraReady) {
      console.log("Camera is ready, starting monitoring");
      const timer = setTimeout(() => {
        startMonitoring();
      }, 1000); // Short delay to ensure camera is initialized
      
      return () => clearTimeout(timer);
    }
  }, [cameraReady]);
  
  return (
    <div className={`monitoring-panel ${cheatingDetected ? 'cheating-detected' : ''}`}>
      <h2>Exam Monitoring</h2>
      
      <div className="monitoring-content">
        <div className="camera-container">
          {/* Video element for capturing camera input - Made visible to help troubleshoot */}
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-feed"
          ></video>
          
          {/* Canvas for capturing frames */}
          <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          
          {/* Display the processed image from backend */}
          {displayImage ? (
            <img 
              src={displayImage} 
              alt="Processed feed" 
              className="processed-feed" 
            />
          ) : (
            <div className="loading-feed">
              <p>Starting camera...</p>
            </div>
          )}
          
          {/* Only show cheating alert when cheatingDetected is true */}
          {cheatingDetected && (
            <div className="cheating-alert">
              <span className="alert-icon">⚠️</span>
              <span>CHEATING DETECTED!</span>
            </div>
          )}
        </div>
        
        <div className="monitoring-controls">
          {isRunning ? (
            <button 
              className="secondary-button"
              onClick={stopMonitoring}
            >
              Pause Monitoring
            </button>
          ) : (
            <button 
              className="primary-button"
              onClick={startMonitoring}
              disabled={!cameraReady}
            >
              Resume Monitoring
            </button>
          )}
          <div className="status-text">
            {cameraReady ? (isRunning ? 'Monitoring active' : 'Monitoring paused') : 'Initializing camera...'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonitoringPanel;