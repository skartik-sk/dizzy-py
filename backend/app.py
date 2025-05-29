from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import mediapipe as mp
import base64
import io
from PIL import Image
import os

app = Flask(__name__)
CORS(app)

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Eye landmark indices for MediaPipe
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]

def calculate_ear(eye_landmarks):
    """Calculate Eye Aspect Ratio"""
    # Vertical distances
    A = np.linalg.norm(eye_landmarks[1] - eye_landmarks[5])
    B = np.linalg.norm(eye_landmarks[2] - eye_landmarks[4])
    # Horizontal distance
    C = np.linalg.norm(eye_landmarks[0] - eye_landmarks[3])
    
    # Eye Aspect Ratio
    ear = (A + B) / (2.0 * C)
    return ear

def process_image(image_bytes):
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        frame = np.array(image)
        
        # Process with MediaPipe
        results = face_mesh.process(frame)
        
        status = "NO FACE DETECTED"
        color = (128, 128, 128)
        
        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                # Get landmark coordinates
                landmarks = []
                for landmark in face_landmarks.landmark:
                    x = int(landmark.x * frame.shape[1])
                    y = int(landmark.y * frame.shape[0])
                    landmarks.append([x, y])
                
                landmarks = np.array(landmarks)
                
                # Extract eye landmarks
                left_eye = landmarks[LEFT_EYE]
                right_eye = landmarks[RIGHT_EYE]
                
                # Calculate EAR for both eyes
                left_ear = calculate_ear(left_eye)
                right_ear = calculate_ear(right_eye)
                
                # Average EAR
                avg_ear = (left_ear + right_ear) / 2.0
                
                # Determine status based on EAR
                if avg_ear < 0.20:
                    status = "SLEEPING !!!"
                    color = (255, 0, 0)
                elif avg_ear < 0.25:
                    status = "DIZZY"
                    color = (255, 255, 0)
                else:
                    status = "ACTIVE"
                    color = (0, 255, 0)
                
                # Draw eye landmarks
                for point in left_eye:
                    cv2.circle(frame, tuple(point), 2, (0, 255, 0), -1)
                for point in right_eye:
                    cv2.circle(frame, tuple(point), 2, (0, 255, 0), -1)
        
        # Add status text
        cv2.putText(frame, status, (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
        
        # Convert back to base64
        pil_img = Image.fromarray(frame)
        buf = io.BytesIO()
        pil_img.save(buf, format='PNG')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        
        return img_base64, status
        
    except Exception as e:
        return None, f"Error: {e}"

@app.route('/api/detect', methods=['POST'])
def detect():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    
    file = request.files['image']
    image_bytes = file.read()
    img_base64, status = process_image(image_bytes)
    
    if img_base64 is None:
        return jsonify({'error': status}), 500
    
    return jsonify({'image': img_base64, 'status': status})

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'model_loaded': True})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)