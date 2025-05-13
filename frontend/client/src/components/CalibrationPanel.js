import React, { useState, useRef, useEffect } from 'react';
import './CalibrationPanel.css';

function CalibrationPanel({ step, totalSteps, instructions, onNextStep }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState('');
  
  useEffect(() => {
    // Set current instruction based on step
    if (instructions && instructions.length > 0 && step < instructions.length) {
      setCurrentInstruction(instructions[step]);
    }
  }, [step, instructions]);

  useEffect(() => {
    // Initialize camera
    async function setupCamera() {
      try {
        console.log("Setting up calibration camera");
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
          videoRef.current.onloadedmetadata = () => {
            setCameraActive(true);
            console.log("Calibration camera ready");
          };
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Failed to access camera. Please ensure your camera is connected and you have granted permission.');
      }
    }
    
    setupCamera();
    
    // Cleanup function
    return () => {
      if (stream) {
        console.log("Cleaning up camera in CalibrationPanel");
        stream.getTracks().forEach(track => {
          track.stop();
          console.log("Track stopped");
        });
      }
    };
  }, []);

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

  const handleNextClick = () => {
    console.log("Next button clicked");
    const imageData = captureImage();
    if (imageData) {
      console.log("Image captured, proceeding to next step");
      onNextStep(imageData);
    } else {
      console.error("Failed to capture image");
      alert("Failed to capture image from camera. Please try again.");
    }
  };

  return (
    <div className="calibration-panel">
      <h2>Calibration</h2>
      <div className="calibration-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(step / totalSteps) * 100}%` }}
          ></div>
        </div>
        <div className="progress-text">
          Step {step + 1} of {totalSteps}
        </div>
      </div>
      
      <div className="calibration-content">
        <div className="camera-container">
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-feed"
          ></video>
          <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          
          {step < totalSteps && (
            <div className="instruction-overlay">
              <div className="target-point"></div>
              <p className="instruction-text">{currentInstruction}</p>
            </div>
          )}
        </div>
        
        <div className="calibration-controls">
          <button 
            className="primary-button"
            onClick={handleNextClick}
            disabled={!cameraActive}
          >
            {step < totalSteps - 1 ? 'Next' : 'Finish Calibration'}
          </button>
          <div className="status-text">
            {!cameraActive && 'Waiting for camera...'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalibrationPanel;


// import React, { useState, useRef, useEffect } from 'react';
// import './CalibrationPanel.css';

// function CalibrationPanel({ step, totalSteps, instructions, onNextStep }) {
//   const videoRef = useRef(null);
//   const canvasRef = useRef(null);
//   const [stream, setStream] = useState(null);
//   const [cameraActive, setCameraActive] = useState(false);
//   const [currentInstruction, setCurrentInstruction] = useState('');
  
//   useEffect(() => {
//     // Set current instruction based on step
//     if (instructions && instructions.length > 0 && step < instructions.length) {
//       setCurrentInstruction(instructions[step]);
//     }
//   }, [step, instructions]);

//   useEffect(() => {
//     // Initialize camera
//     async function setupCamera() {
//       try {
//         console.log("Setting up calibration camera");
//         const constraints = {
//           video: {
//             width: { ideal: 640 },
//             height: { ideal: 480 },
//             facingMode: 'user'
//           }
//         };
        
//         const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
//         setStream(mediaStream);
        
//         if (videoRef.current) {
//           videoRef.current.srcObject = mediaStream;
//           // Mirror the video for the calibration preview
//           videoRef.current.style.transform = 'scaleX(-1)';
//           videoRef.current.onloadedmetadata = () => {
//             setCameraActive(true);
//             console.log("Calibration camera ready");
//           };
//         }
//       } catch (error) {
//         console.error('Error accessing camera:', error);
//         alert('Failed to access camera. Please ensure your camera is connected and you have granted permission.');
//       }
//     }
    
//     setupCamera();
    
//     // Cleanup function
//     return () => {
//       if (stream) {
//         console.log("Cleaning up camera in CalibrationPanel");
//         stream.getTracks().forEach(track => {
//           track.stop();
//           console.log("Track stopped");
//         });
//       }
//     };
//   }, []);

//   const captureImage = () => {
//     const video = videoRef.current;
//     const canvas = canvasRef.current;
    
//     if (video && canvas && video.readyState === 4) { // 4 = HAVE_ENOUGH_DATA
//       const context = canvas.getContext('2d');
//       canvas.width = video.videoWidth;
//       canvas.height = video.videoHeight;
      
//       // Mirror draw to match flipped preview
//       context.translate(canvas.width, 0);
//       context.scale(-1, 1);
//       context.drawImage(video, 0, 0, canvas.width, canvas.height);
//       // Reset transform
//       context.setTransform(1, 0, 0, 1, 0, 0);
      
//       const imageData = canvas.toDataURL('image/jpeg');
//       return imageData;
//     }
//     return null;
//   };

//   const handleNextClick = () => {
//     console.log("Next button clicked");
//     const imageData = captureImage();
//     if (imageData) {
//       console.log("Image captured, proceeding to next step");
//       onNextStep(imageData);
//     } else {
//       console.error("Failed to capture image");
//       alert("Failed to capture image from camera. Please try again.");
//     }
//   };

//   return (
//     <div className="calibration-panel">
//       <h2>Calibration</h2>
//       <div className="calibration-progress">
//         <div className="progress-bar">
//           <div 
//             className="progress-fill" 
//             style={{ width: `${(step / totalSteps) * 100}%` }}
//           ></div>
//         </div>
//         <div className="progress-text">
//           Step {step + 1} of {totalSteps}
//         </div>
//       </div>
      
//       <div className="calibration-content">
//         <div className="camera-container">
//           <video 
//             ref={videoRef}
//             autoPlay
//             playsInline
//             muted
//             className="camera-feed"
//           ></video>
//           <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          
//           {step < totalSteps && (
//             <div className="instruction-overlay">
//               <div className="target-point"></div>
//               <p className="instruction-text">{currentInstruction}</p>
//             </div>
//           )}
//         </div>
        
//         <div className="calibration-controls">
//           <button 
//             className="primary-button"
//             onClick={handleNextClick}
//             disabled={!cameraActive}
//           >
//             {step < totalSteps - 1 ? 'Next' : 'Finish Calibration'}
//           </button>
//           <div className="status-text">
//             {!cameraActive && 'Waiting for camera...'}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default CalibrationPanel;
