from flask import Flask, request, jsonify
from flask_cors import CORS
from cheating import CheatingDetector
import json
import logging

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the detector
detector = CheatingDetector()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint to check if the server is running"""
    return jsonify({"status": "ok", "message": "Server is running"})

@app.route('/calibration/start', methods=['POST'])
def start_calibration():
    """Endpoint to start the calibration process"""
    try:
        result = detector.start_calibration()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error starting calibration: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/calibration/step', methods=['POST'])
def calibration_step():
    """Endpoint to process a single calibration step"""
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({"status": "error", "message": "No image data provided"}), 400
            
        result = detector.process_calibration_step(data['image'])
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error processing calibration step: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze_frame():
    """Endpoint to analyze a video frame for cheating detection"""
    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({"status": "error", "message": "No image data provided"}), 400
            
        if not detector.calibrated:
            return jsonify({
                "status": "error", 
                "message": "Detector not calibrated. Please complete calibration first."
            }), 400
            
        result = detector.process_frame(data['image'])
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error analyzing frame: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/status', methods=['GET'])
def detector_status():
    """Endpoint to check the status of the detector"""
    return jsonify({
        "calibrated": detector.calibrated,
        "calibration_step": detector.current_step if not detector.calibrated else "complete",
        "tracking_started": detector.tracking_started
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)