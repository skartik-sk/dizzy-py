// src/api.js
export async function detectDrowsiness(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch('http://localhost:5001/api/detect', {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    throw new Error('Failed to detect drowsiness');
  }
  return await response.json();
}
