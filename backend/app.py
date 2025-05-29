from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
import dlib
from imutils import face_utils
import base64
import io
from PIL import Image
import os

app = Flask(__name__)
CORS(app)

# Load model - updated to work with model in same directory
model_path = os.path.join(os.path.dirname(__file__), 'shape_predictor_68_face_landmarks.dat')

try:
    detector = dlib.get_frontal_face_detector()
    if os.path.exists(model_path):
        predictor = dlib.shape_predictor(model_path)
        print("Model loaded successfully")
    else:
        print(f"Model file not found at: {model_path}")
        predictor = None
except Exception as e:
    print(f"Error loading dlib models: {e}")
    detector = None
    predictor = None

# Status variables
def process_image(image_bytes):
    sleep = 0
    drowsy = 0
    active = 0
    status = ""
    color = (0, 0, 0)
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        frame = np.array(image)
        frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = detector(gray)
        for face in faces:
            x1 = face.left()
            y1 = face.top()
            x2 = face.right()
            y2 = face.bottom()
            landmarks = predictor(gray, face)
            landmarks = face_utils.shape_to_np(landmarks)
            def compute(ptA, ptB):
                return np.linalg.norm(ptA - ptB)
            def blinked(a, b, c, d, e, f):
                up = compute(b, d) + compute(c, e)
                down = compute(a, f)
                ratio = up / (2.0 * down)
                if ratio > 0.25:
                    return 2
                elif ratio > 0.21 and ratio <= 0.25:
                    return 1
                else:
                    return 0
            left_blink = blinked(landmarks[36], landmarks[37], landmarks[38], landmarks[41], landmarks[40], landmarks[39])
            right_blink = blinked(landmarks[42], landmarks[43], landmarks[44], landmarks[47], landmarks[46], landmarks[45])
            # Dizziness logic: if both eyes are partially closed (drowsy) for 2+ frames
            if left_blink == 1 and right_blink == 1:
                drowsy += 1
                sleep = 0
                active = 0
                if drowsy > 1:
                    status = "DIZZY"
                    color = (255, 255, 0)
            # Sleep logic: if both eyes are fully closed for 1+ frames
            elif left_blink == 0 and right_blink == 0:
                sleep += 1
                drowsy = 0
                active = 0
                # Always set status to SLEEPING when eyes are closed
                # The frontend will handle the 5-second threshold
                status = "SLEEPING !!!"
                color = (255, 0, 0)
            # Active logic: if both eyes are open
            elif left_blink == 2 and right_blink == 2:
                active += 1
                sleep = 0
                drowsy = 0
                if active > 0:
                    status = "ACTIVE"
                    color = (0, 255, 0)
            else:
                status = "UNKNOWN"
                color = (128, 128, 128)
            cv2.putText(frame, status, (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
            for n in range(0, 68):
                (x, y) = landmarks[n]
                cv2.circle(frame, (x, y), 1, (255, 255, 255), -1)
        # Convert back to PIL Image
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
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
    if detector is None or predictor is None:
        return jsonify({'error': 'Model not loaded properly'}), 500
    
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
    return jsonify({'status': 'healthy', 'model_loaded': detector is not None and predictor is not None})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
