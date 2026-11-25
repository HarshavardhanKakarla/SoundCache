import axios from 'axios';

const API_BASE_URL = 'https://soundcache.onrender.com';

const client = axios.create({
  timeout: 15000,
});

/**
 * Fetch nearby capsules based on user's current GPS location
 */
export async function fetchNearbyCapsules(latitude, longitude, maxDistance = 5000) {
  const res = await client.get(`${API_BASE_URL}/api/capsules/nearby`, {
    params: { lat: latitude, lng: longitude, maxDistance },
  });
  return res.data.capsules || [];
}

/**
 * Upload and drop a new audio capsule with real audio file
 */
export async function dropCapsuleApi({
  title,
  author,
  category,
  duration,
  latitude,
  longitude,
  audioUri,
}) {
  if (!audioUri) {
    throw new Error('Audio recording is required');
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('author', author || 'Anonymous Explorer');
  formData.append('category', category || 'Story');
  formData.append('duration', String(duration || 15));
  formData.append('latitude', String(latitude));
  formData.append('longitude', String(longitude));

  const filename = audioUri.split('/').pop() || 'recording.m4a';
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/mp4';

  formData.append('audio', {
    uri: audioUri,
    name: filename,
    type: mimeType,
  });

  const res = await axios.post(`${API_BASE_URL}/api/capsules`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 30000,
  });

  return res.data;
}

/**
 * Like a capsule
 */
export async function likeCapsuleApi(capsuleId) {
  try {
    const res = await client.post(`${API_BASE_URL}/api/capsules/${capsuleId}/like`);
    return res.data;
  } catch (err) {
    console.warn('Like failed:', err.message);
  }
}

/**
 * Record a listen event
 */
export async function recordListenApi(capsuleId) {
  try {
    const res = await client.post(`${API_BASE_URL}/api/capsules/${capsuleId}/listen`);
    return res.data;
  } catch (err) {
    console.warn('Record listen failed:', err.message);
  }
}
