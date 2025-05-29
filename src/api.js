// src/api.js
export async function detectDrowsiness(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch('https://dizzyness-app-latest.onrender.com/api/detect', {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    throw new Error('Failed to detect drowsiness');
  }
  return await response.json();
}
