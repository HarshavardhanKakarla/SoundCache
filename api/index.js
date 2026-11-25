const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Render) so req.protocol is 'https'
app.set('trust proxy', 1);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Serve web UI dashboard
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Multer setup — store in memory buffer so audio persists with capsule
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

// Haversine distance calculation in meters between two lat/lng points
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function resolveMimeType(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.m4a' || ext === '.mp4') return 'audio/mp4';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.aac') return 'audio/aac';
  if (ext === '.webm') return 'audio/webm';
  if (ext === '.ogg') return 'audio/ogg';
  if (file.mimetype && file.mimetype.startsWith('audio/')) return file.mimetype;
  return 'audio/mp4';
}

// --------------- IN-MEMORY CAPSULE STORE --------------- //
const memoryCapsules = [];

// ---------------- ROUTES ---------------- //

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SoundCache API',
    capsuleCount: memoryCapsules.length,
    uptime: process.uptime(),
  });
});

// GET /api/capsules/nearby?lat=...&lng=...&maxDistance=...
app.get('/api/capsules/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const maxDistance = parseFloat(req.query.maxDistance) || 5000;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng query params are required' });
    }

    const capsules = memoryCapsules.filter((cap) => {
      const [cLng, cLat] = cap.location.coordinates;
      const dist = calculateDistanceMeters(lat, lng, cLat, cLng);
      return dist <= maxDistance;
    });

    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    const enrichedCapsules = capsules.map((cap) => {
      const [cLng, cLat] = cap.location.coordinates;
      const distanceMeters = calculateDistanceMeters(lat, lng, cLat, cLng);
      const isUnlocked = distanceMeters <= (cap.unlockRadius || 30);

      // Protect locked capsules: do NOT expose audioUrl or exact coordinates
      return {
        _id: cap._id,
        title: cap.title,
        author: cap.author,
        category: cap.category,
        duration: cap.duration,
        description: isUnlocked ? cap.description : '',
        unlockRadius: cap.unlockRadius,
        listens: cap.listens,
        likes: cap.likes,
        createdAt: cap.createdAt,
        distanceMeters,
        isUnlocked,
        audioUrl: isUnlocked && cap.audioBuffer ? `${baseUrl}/api/capsules/${cap._id}/audio` : null,
        previewAvailable: isUnlocked && !!cap.audioBuffer,
      };
    });

    enrichedCapsules.sort((a, b) => a.distanceMeters - b.distanceMeters);

    res.json({
      count: enrichedCapsules.length,
      unlockThresholdMeters: 30,
      capsules: enrichedCapsules,
    });
  } catch (err) {
    console.error('Error fetching nearby capsules:', err);
    res.status(500).json({ error: 'Failed to fetch capsules' });
  }
});

// GET /api/capsules/:id/audio — stream audio with HTTP Range support for Android ExoPlayer & Web
app.get('/api/capsules/:id/audio', (req, res) => {
  const cap = memoryCapsules.find((c) => c._id === req.params.id);
  if (!cap || !cap.audioBuffer) {
    return res.status(404).json({ error: 'Audio not found' });
  }

  const buffer = cap.audioBuffer;
  const total = buffer.length;
  const contentType = cap.audioMimeType || 'audio/mp4';
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

    if (isNaN(start) || start >= total || end >= total || start > end) {
      return res.status(416).set('Content-Range', `bytes */${total}`).end();
    }

    const chunkSize = end - start + 1;
    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    });
    return res.send(buffer.subarray(start, end + 1));
  }

  res.set({
    'Content-Type': contentType,
    'Content-Length': total,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
  });
  res.send(buffer);
});

// POST /api/capsules (Upload and Drop new capsule)
app.post('/api/capsules', upload.single('audio'), async (req, res) => {
  try {
    const { title, author, category, duration, latitude, longitude, description } = req.body;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: 'Audio recording file is required' });
    }

    const audioMimeType = resolveMimeType(req.file);
    const capsuleId = 'cap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    const newCapsule = {
      _id: capsuleId,
      title: title.trim(),
      author: (author || 'Anonymous Explorer').trim(),
      category: category || 'Story',
      duration: duration ? parseInt(duration, 10) : 15,
      audioBuffer: req.file.buffer,
      audioMimeType,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      unlockRadius: 30,
      listens: 0,
      likes: 0,
      description: description || '',
      createdAt: new Date(),
    };

    memoryCapsules.push(newCapsule);

    console.log(
      `[SoundCache] Dropped capsule "${newCapsule.title}" (${(req.file.size / 1024).toFixed(1)} KB, ${audioMimeType})`
    );

    const host = req.get('host');
    const baseUrl = `${req.protocol}://${host}`;

    res.status(201).json({
      _id: capsuleId,
      title: newCapsule.title,
      author: newCapsule.author,
      category: newCapsule.category,
      duration: newCapsule.duration,
      unlockRadius: newCapsule.unlockRadius,
      listens: 0,
      likes: 0,
      createdAt: newCapsule.createdAt,
      audioUrl: `${baseUrl}/api/capsules/${capsuleId}/audio`,
      hasAudio: true,
    });
  } catch (err) {
    console.error('Error creating capsule:', err);
    res.status(500).json({ error: 'Failed to save capsule' });
  }
});

// POST /api/capsules/:id/like
app.post('/api/capsules/:id/like', async (req, res) => {
  const cap = memoryCapsules.find((c) => c._id === req.params.id);
  if (cap) {
    cap.likes = (cap.likes || 0) + 1;
    return res.json({ likes: cap.likes });
  }
  return res.status(404).json({ error: 'Capsule not found' });
});

// POST /api/capsules/:id/listen
app.post('/api/capsules/:id/listen', async (req, res) => {
  const cap = memoryCapsules.find((c) => c._id === req.params.id);
  if (cap) {
    cap.listens = (cap.listens || 0) + 1;
    return res.json({ listens: cap.listens });
  }
  return res.status(404).json({ error: 'Capsule not found' });
});

// DELETE /api/capsules/:id
app.delete('/api/capsules/:id', (req, res) => {
  const idx = memoryCapsules.findIndex((c) => c._id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Capsule not found' });
  }
  memoryCapsules.splice(idx, 1);
  res.json({ message: 'Capsule deleted' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SoundCache Spatial API running on port ${PORT}`);
  });
}

module.exports = app;
