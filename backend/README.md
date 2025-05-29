# Flask Backend for Drowsiness Detection

## Setup

1. Create a virtual environment (recommended):
   ```zsh
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```zsh
   pip install -r requirements.txt
   ```
3. Make sure `shape_predictor_68_face_landmarks.dat` is in the project root (one level above this backend folder).
4. Run the backend:
   ```zsh
   python app.py
   ```

The backend will be available at http://localhost:5000

## API
- POST `/api/detect` with form-data key `image` (an image file).
- Returns JSON with keys: `image` (base64 PNG) and `status` (string).
