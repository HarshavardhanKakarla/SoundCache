import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getDefaultApiUrl() {
  // Use live production cloud backend on Render by default
  return 'https://soundcache.onrender.com';
}

let API_BASE_URL = getDefaultApiUrl();

export function setCustomApiUrl(url) {
  if (url && url.trim()) {
    API_BASE_URL = url.trim();
  }
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

const client = axios.create({
  timeout: 8000,
});

/**
 * Fetch nearby capsules based on user's current GPS location
 */
export async function fetchNearbyCapsules(latitude, longitude, maxDistance = 5000) {
  try {
    const res = await client.get(`${API_BASE_URL}/api/capsules/nearby`, {
      params: { lat: latitude, lng: longitude, maxDistance },
    });
    return res.data.capsules || [];
  } catch (error) {
    console.warn('Network call failed, returning empty or fallback:', error?.message);
    throw error;
  }
}

/**
 * Upload and drop a new audio capsule
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
  const formData = new FormData();
  formData.append('title', title);
  formData.append('author', author || 'Anonymous Explorer');
  formData.append('category', category || 'Story');
  formData.append('duration', String(duration || 15));
  formData.append('latitude', String(latitude));
  formData.append('longitude', String(longitude));

  if (audioUri) {
    const filename = audioUri.split('/').pop() || 'recording.m4a';
    formData.append('audio', {
      uri: audioUri,
      name: filename,
      type: 'audio/m4a',
    });
  }

  const res = await axios.post(`${API_BASE_URL}/api/capsules`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
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

/**
 * Seed sample capsules around coordinates
 */
export async function seedCapsulesApi(latitude, longitude) {
  const res = await client.post(`${API_BASE_URL}/api/capsules/seed`, {
    latitude,
    longitude,
  });
  return res.data;
}

