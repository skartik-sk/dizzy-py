FROM python:3.11-slim

# Install system dependencies including OpenGL libraries
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgtk-3-0 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libxrender1 \
    libxext6 \
    libsm6 \
    libice6 \
    libfontconfig1 \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install  -r requirements.txt

# Copy the application code
COPY . .

# Set environment variable to use headless OpenCV
ENV QT_QPA_PLATFORM=offscreen

# Expose the port
EXPOSE 5001

# Run the application
CMD ["python", "app.py"]