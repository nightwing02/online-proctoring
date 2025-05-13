import cv2
import mediapipe as mp
import numpy as np
import time
import base64

class CheatingDetector:
    def __init__(self, ear_threshold=0.25, eye_closed_time_limit=0.5,                   #def __init__(self, ear_threshold=0.25, eye_closed_time_limit=0.5,
                 eye_movement_threshold_lr=5, eye_movement_threshold_ud=5):             #eye_movement_threshold_lr=5, eye_movement_threshold_ud=5):              
        # Initialize MediaPipe modules
        self.mp_face_mesh = mp.solutions.face_mesh
        
        # Main face mesh for detection
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False, 
            max_num_faces=1, 
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Smoothing factor
        self.alpha = 0.4
        
        # Eye tracking thresholds
        self.ear_threshold = ear_threshold  # Eye aspect ratio threshold
        self.eye_closed_time_limit = eye_closed_time_limit  # seconds
        self.frames_threshold_lr = eye_movement_threshold_lr
        self.frames_threshold_ud = eye_movement_threshold_ud
        
        # Calibration state
        self.calibrated = False
        self.tracking_started = False
        self.current_step = 0
        self.calibration_data = {}
        
        # Landmarks for tracking
        self.nose_landmark = 1
        self.left_face_landmark = 234
        self.right_face_landmark = 454
        self.left_eye_landmarks = [33, 133, 160, 158, 159, 144, 153, 145, 154, 163, 7, 246]
        self.right_eye_landmarks = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387]
        
        # EAR calculation landmarks
        self.left_ear_landmarks = [33, 160, 158, 133, 153, 144]
        self.right_ear_landmarks = [362, 385, 387, 263, 373, 380]
        
        # Head movement thresholds (computed after calibration)
        self.head_movement_tolerance = None
        self.face_rotation_threshold_left = None
        self.face_rotation_threshold_right = None
        self.face_rotation_threshold_up = None
        self.face_rotation_threshold_down = None
        
        # Eye tracking state variables
        self.smoothed_right_iris = None
        self.smoothed_left_iris = None
        self.left_frames_outside = 0
        self.right_frames_outside = 0
        self.frames_no_pupil_ud = 0
        self.cheat_start_time_ud = None
        self.left_eye_closed_start_time = None
        self.right_eye_closed_start_time = None
        self.left_cheating_detected = False
        self.right_cheating_detected = False
        
        # For iris tracking
        self.calibrated_positions = {}  # Will store center, left, right positions

    def smooth_position(self, new_pos, smoothed_pos):
        """Applies exponential moving average (EMA) for smoothing."""
        if smoothed_pos is None:
            return new_pos  # Initialize with the first position
        return self.alpha * new_pos + (1 - self.alpha) * smoothed_pos

    def get_iris_center(self, face_landmarks, w, h):
        """Calculates the center of the iris using key iris landmarks."""
        right_iris_x = (face_landmarks.landmark[468].x + face_landmarks.landmark[472].x) / 2 * w
        right_iris_y = (face_landmarks.landmark[468].y + face_landmarks.landmark[472].y) / 2 * h

        left_iris_x = (face_landmarks.landmark[473].x + face_landmarks.landmark[477].x) / 2 * w
        left_iris_y = (face_landmarks.landmark[473].y + face_landmarks.landmark[477].y) / 2 * h

        return np.array([right_iris_x, right_iris_y]), np.array([left_iris_x, left_iris_y])

    def compute_EAR(self, eye_points, landmarks):
        """Compute Eye Aspect Ratio using Euclidean distances between the landmarks."""
        p2_minus_p6 = np.linalg.norm(np.array(landmarks[eye_points[1]]) - np.array(landmarks[eye_points[5]]))
        p3_minus_p5 = np.linalg.norm(np.array(landmarks[eye_points[2]]) - np.array(landmarks[eye_points[4]]))
        p1_minus_p4 = np.linalg.norm(np.array(landmarks[eye_points[0]]) - np.array(landmarks[eye_points[3]]))
        EAR = (p2_minus_p6 + p3_minus_p5) / (2.0 * p1_minus_p4)
        return EAR

    def start_calibration(self):
        """Reset calibration state to begin a new calibration sequence"""
        self.calibrated = False
        self.current_step = 0
        self.calibration_data = {}
        self.calibrated_positions = {}
        
        # Define calibration steps for the frontend
        calibration_steps = [
            "Look at the CENTER and press Next",
            "Look at the LEFT edge and press Next",
            "Look at the RIGHT edge and press Next",
            "Look at the TOP edge and press Next",
            "Look at the BOTTOM edge and press Next"
        ]
        
        return {
            "status": "calibration_started",
            "steps": calibration_steps,
            "current_step": 0,
            "total_steps": len(calibration_steps)
        }

    def process_calibration_step(self, img_data):
        """Process one calibration step with the given image data"""
        # Decode image data
        encoded_data = img_data.split(',')[1]
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        h, w, _ = frame.shape
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)
        
        if not results.multi_face_landmarks:
            return {
                "status": "error",
                "message": "No face detected in calibration image"
            }
        
        # Get landmarks for current step
        face_landmarks = results.multi_face_landmarks[0]
        landmarks_dict = {idx: (int(lm.x * w), int(lm.y * h))
                         for idx, lm in enumerate(face_landmarks.landmark)}
        
        head_x, head_y = landmarks_dict[self.nose_landmark]
        face_width = abs(landmarks_dict[self.left_face_landmark][0] - landmarks_dict[self.right_face_landmark][0])
        
        # Get iris positions for tracking calibration
        right_iris, left_iris = self.get_iris_center(face_landmarks, w, h)
        
        # Store calibration data
        self.calibration_data[self.current_step] = {
            "head": (head_x, head_y), 
            "face_width": face_width
        }
        
        # Store iris data for specific steps
        if self.current_step == 0:  # Center
            if "center" not in self.calibrated_positions:
                self.calibrated_positions["center"] = []
            self.calibrated_positions["center"].append((right_iris, left_iris))
        elif self.current_step == 1:  # Left
            if "left" not in self.calibrated_positions:
                self.calibrated_positions["left"] = []
            self.calibrated_positions["left"].append((right_iris, left_iris))
        elif self.current_step == 2:  # Right
            if "right" not in self.calibrated_positions:
                self.calibrated_positions["right"] = []
            self.calibrated_positions["right"].append((right_iris, left_iris))
        
        self.current_step += 1
        
        # Check if all calibration steps are completed
        if self.current_step >= 5:  # Total calibration steps
            # Process head movement thresholds
            head_center = self.calibration_data[0]["head"]
            ref_face_width = self.calibration_data[0]["face_width"]
            
            self.head_movement_tolerance = abs(self.calibration_data[2]["head"][0] - self.calibration_data[1]["head"][0]) // 2
            self.face_rotation_threshold_left = abs(self.calibration_data[2]["face_width"] - ref_face_width) // 2
            self.face_rotation_threshold_right = self.face_rotation_threshold_left
            self.face_rotation_threshold_up = abs(self.calibration_data[3]["head"][1] - head_center[1]) // 2
            self.face_rotation_threshold_down = abs(self.calibration_data[4]["head"][1] - head_center[1]) // 2
            
            # Process iris calibration data
            for key in ["center", "left", "right"]:
                if key in self.calibrated_positions and self.calibrated_positions[key]:
                    # Average the positions
                    right_positions = np.array([p[0] for p in self.calibrated_positions[key]])
                    left_positions = np.array([p[1] for p in self.calibrated_positions[key]])
                    
                    self.calibrated_positions[key] = (
                        np.mean(right_positions, axis=0),
                        np.mean(left_positions, axis=0)
                    )
            
            self.calibrated = True
            return {
                "status": "calibration_complete",
                "message": "Calibration completed successfully"
            }
        else:
            return {
                "status": "calibration_in_progress",
                "current_step": self.current_step,
                "total_steps": 5
            }

    def process_frame(self, img_data):
        """
        Process a frame from base64 image data and detect cheating
        """
        if not self.calibrated:
            return {
                "status": "error",
                "message": "Not calibrated. Please complete calibration first."
            }
        
        # Decode image data
        encoded_data = img_data.split(',')[1]
        nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        h, w, _ = frame.shape
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)
        
        # Initialize alert messages
        head_alert = "Head OK"
        eye_lr_alert = "Eye LR OK"
        eye_ud_alert = "Eye UD OK"
        eye_oc_alert = "Eye OC OK"
        
        cheating_detected = False
        
        if not results.multi_face_landmarks:
            # Return result with base64 image
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            return {
                "status": "no_face",
                "cheating_detected": False,
                "frame": f"data:image/jpeg;base64,{frame_base64}",
                "messages": ["No face detected"]
            }
        
        face_landmarks = results.multi_face_landmarks[0]
        
        # Convert landmarks to dictionary for easier access
        landmarks_dict = {idx: (int(lm.x * w), int(lm.y * h))
                         for idx, lm in enumerate(face_landmarks.landmark)}
        
        # -------------- Head Movement Detection --------------
        head_x, head_y = landmarks_dict[self.nose_landmark]
        face_width = abs(landmarks_dict[self.left_face_landmark][0] - landmarks_dict[self.right_face_landmark][0])
        
        head_center = self.calibration_data[0]["head"]
        ref_face_width = self.calibration_data[0]["face_width"]
        
        # Check if head position is within allowed range
        head_movement_allowed = (
            (head_center[0] - self.head_movement_tolerance < head_x < head_center[0] + self.head_movement_tolerance) and
            (head_center[1] - self.head_movement_tolerance < head_y < head_center[1] + self.head_movement_tolerance)
        )
        
        # Check face rotation
        face_rotation_left = (face_width - ref_face_width) > self.face_rotation_threshold_left
        face_rotation_right = (ref_face_width - face_width) > self.face_rotation_threshold_right
        face_rotation_up = (head_center[1] - head_y) > self.face_rotation_threshold_up
        face_rotation_down = (head_y - head_center[1]) > self.face_rotation_threshold_down
        
        if not head_movement_allowed and (face_rotation_left or face_rotation_right or face_rotation_up or face_rotation_down):
            head_alert = "HEAD CHEATING ALERT!"
            cheating_detected = True
        
        # -------------- Eye Left/Right Movement Detection --------------
        left_eye_points = []
        for idx in self.left_eye_landmarks:
            left_eye_points.append(landmarks_dict[idx])
        
        if left_eye_points:
            x_coords = [p[0] for p in left_eye_points]
            y_coords = [p[1] for p in left_eye_points]
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            padding = 5
            roi_top = max(0, min_y - padding)
            roi_bottom = min(h, max_y + padding)
            roi_left = max(0, min_x - padding)
            roi_right = min(w, max_x + padding)
            eye_roi_lr = frame[roi_top:roi_bottom, roi_left:roi_right]
            
            if eye_roi_lr.size != 0:
                gray_eye = cv2.cvtColor(eye_roi_lr, cv2.COLOR_BGR2GRAY)
                _, thresh_eye = cv2.threshold(gray_eye, 50, 255, cv2.THRESH_BINARY_INV)
                contours, _ = cv2.findContours(thresh_eye, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if contours:
                    c = max(contours, key=cv2.contourArea)
                    M = cv2.moments(c)
                    if M["m00"] != 0:
                        pupil_x_roi = int(M["m10"] / M["m00"])
                        pupil_y_roi = int(M["m01"] / M["m00"])
                        cv2.circle(eye_roi_lr, (pupil_x_roi, pupil_y_roi), 2, (0, 0, 255), -1)
                        
                        pupil_x_global = roi_left + pupil_x_roi
                        eye_center_x = (min_x + max_x) // 2
                        eye_width = max_x - min_x
                        EXTREME_THRESHOLD_LR = 0.2 * (eye_width / 2)
                        
                        dist_from_center = abs(pupil_x_global - eye_center_x)
                        if dist_from_center > EXTREME_THRESHOLD_LR:
                            self.left_frames_outside += 1
                        else:
                            self.left_frames_outside = 0
                            
                        if self.left_frames_outside > self.frames_threshold_lr:
                            eye_lr_alert = "EYE LR CHEATING ALERT!"
                            cheating_detected = True
        
        # -------------- Eye Up/Down Movement Detection --------------
        right_eye_points = []
        for idx in self.right_eye_landmarks:
            right_eye_points.append(landmarks_dict[idx])
        
        if right_eye_points:
            x_coords = [p[0] for p in right_eye_points]
            y_coords = [p[1] for p in right_eye_points]
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            padding = 5
            roi_top = max(0, min_y - padding)
            roi_bottom = min(h, max_y + padding)
            roi_left = max(0, min_x - padding)
            roi_right = min(w, max_x + padding)
            eye_roi_ud = frame[roi_top:roi_bottom, roi_left:roi_right]
            
            # Dynamic threshold based on eye height
            eye_height = max_y - min_y
            EXTREME_THRESHOLD_UD = eye_height * 0.75  #0.25
            
            pupil_detected = False
            if eye_roi_ud.size != 0:
                gray_eye_ud = cv2.cvtColor(eye_roi_ud, cv2.COLOR_BGR2GRAY)
                _, thresh_eye_ud = cv2.threshold(gray_eye_ud, 50, 255, cv2.THRESH_BINARY_INV)
                contours, _ = cv2.findContours(thresh_eye_ud, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                if contours:
                    c = max(contours, key=cv2.contourArea)
                    M = cv2.moments(c)
                    if M["m00"] != 0:
                        pupil_x_roi = int(M["m10"] / M["m00"])
                        pupil_y_roi = int(M["m01"] / M["m00"])
                        cv2.circle(eye_roi_ud, (pupil_x_roi, pupil_y_roi), 2, (0, 0, 255), -1)
                        
                        pupil_x_global = roi_left + pupil_x_roi
                        pupil_y_global = roi_top + pupil_y_roi
                        eye_center_y = (min_y + max_y) // 2
                        
                        dist_from_center_ud = abs(pupil_y_global - eye_center_y)
                        pupil_detected = True
                        
                        if dist_from_center_ud > EXTREME_THRESHOLD_UD:
                            self.right_frames_outside += 1
                        else:
                            self.right_frames_outside = 0
            
            if not pupil_detected:
                self.frames_no_pupil_ud += 1
            else:
                self.frames_no_pupil_ud = 0
            
            if self.right_frames_outside > self.frames_threshold_ud or self.frames_no_pupil_ud > self.frames_threshold_ud:
                if self.cheat_start_time_ud is None:
                    self.cheat_start_time_ud = time.time()
                else:
                    elapsed_ud = time.time() - self.cheat_start_time_ud
                    if elapsed_ud >= 1.0:  # Using 1 second threshold as in original
                        eye_ud_alert = "EYE UD CHEATING ALERT!"
                        cheating_detected = True
            else:
                self.cheat_start_time_ud = None
        
        # -------------- Eye Open/Close Detection --------------
        # Build list of landmark coordinates for EAR calculation
        landmarks_oc = []
        for lm in face_landmarks.landmark:
            landmarks_oc.append((int(lm.x * w), int(lm.y * h)))
        
        left_EAR = self.compute_EAR(self.left_ear_landmarks, landmarks_oc)
        right_EAR = self.compute_EAR(self.right_ear_landmarks, landmarks_oc)
        
        # Process left eye
        if left_EAR < self.ear_threshold:
            if self.left_eye_closed_start_time is None:
                self.left_eye_closed_start_time = time.time()
            else:
                elapsed_left = time.time() - self.left_eye_closed_start_time
                if elapsed_left > self.eye_closed_time_limit:
                    self.left_cheating_detected = True
        else:
            self.left_eye_closed_start_time = None
            self.left_cheating_detected = False
        
        # Process right eye
        if right_EAR < self.ear_threshold:
            if self.right_eye_closed_start_time is None:
                self.right_eye_closed_start_time = time.time()
            else:
                elapsed_right = time.time() - self.right_eye_closed_start_time
                if elapsed_right > self.eye_closed_time_limit:
                    self.right_cheating_detected = True
        else:
            self.right_eye_closed_start_time = None
            self.right_cheating_detected = False
        
        # If either eye is flagged, set alert
        if self.left_cheating_detected or self.right_cheating_detected:
            eye_oc_alert = "EYE OC CHEATING ALERT!"
            cheating_detected = True
        
        # -------------- Iris Tracking (from target format) --------------
        right_iris, left_iris = self.get_iris_center(face_landmarks, w, h)
        
        # Apply smoothing to iris positions
        self.smoothed_right_iris = self.smooth_position(right_iris, self.smoothed_right_iris)
        self.smoothed_left_iris = self.smooth_position(left_iris, self.smoothed_left_iris)
        
        # Draw smoothed iris positions for visualization
        if self.smoothed_right_iris is not None and self.smoothed_left_iris is not None:
            cv2.circle(frame, tuple(self.smoothed_right_iris.astype(int)), 3, (0, 255, 0), -1)
            cv2.circle(frame, tuple(self.smoothed_left_iris.astype(int)), 3, (0, 255, 0), -1)
            
            # Only check if we have calibration data
            if "center" in self.calibrated_positions and self.calibrated_positions["center"][0] is not None:
                # Compute current average eye position
                current_eye = (self.smoothed_right_iris + self.smoothed_left_iris) / 2
                
                # Get calibrated positions
                center_right, center_left = self.calibrated_positions["center"]
                average_eye_center = (center_right + center_left) / 2
                
                if "left" in self.calibrated_positions and "right" in self.calibrated_positions:
                    left_right, left_left = self.calibrated_positions["left"]
                    average_eye_left = (left_right + left_left) / 2
                    
                    right_right, right_left = self.calibrated_positions["right"]
                    average_eye_right = (right_right + right_left) / 2
                    
                    # Calculate horizontal deviation from center
                    deviation = abs(current_eye[0] - average_eye_center[0])
                    # Allowed deviation: set as fraction of half the calibrated range
                    allowed_deviation = 0.8 * (average_eye_right[0] - average_eye_left[0]) / 2
                    
                    # Debug prints
                    cv2.putText(frame, f"Eye Pos: {tuple(current_eye.astype(int))}", (50, 100),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                    cv2.putText(frame, f"Deviation: {deviation:.1f}", (50, 130),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                    
                    # If deviation exceeds allowed range, flag cheating
                    if deviation > allowed_deviation:
                        cheating_detected = True
                        cv2.putText(frame, "Cheating (Eyes Too Far)!", (50, 80),
                                  cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        
        # Display all alert messages
        alerts = [
            ("Head: " + head_alert, (0, 0, 255) if "ALERT" in head_alert else (0, 255, 0)),
            ("Eye LR: " + eye_lr_alert, (0, 0, 255) if "ALERT" in eye_lr_alert else (0, 255, 0)),
            ("Eye UD: " + eye_ud_alert, (0, 0, 255) if "ALERT" in eye_ud_alert else (0, 255, 0)),
            ("Eye OC: " + eye_oc_alert, (0, 0, 255) if "ALERT" in eye_oc_alert else (0, 255, 0))
        ]
        
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.6
        thickness = 2
        start_y = 30
        
        for i, (text, color) in enumerate(alerts):
            (w_text, h_text), _ = cv2.getTextSize(text, font, font_scale, thickness)
            pos = (w - w_text - 10, start_y + i * (h_text + 10))
            cv2.putText(frame, text, pos, font, font_scale, color, thickness)
        
        # Encode the frame with annotations back to base64
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return {
            "status": "ok",
            "cheating_detected": cheating_detected,
            "frame": f"data:image/jpeg;base64,{frame_base64}",
            "messages": [alert[0] for alert in alerts]
        }