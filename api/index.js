require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
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

function streamAudioBuffer(req, res, buffer, contentType) {
  const total = buffer.length;
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
}

// --------------- DATABASE CONNECTION --------------- //
let isMongoConnected = false;
let CapsuleModel = null;
const memoryCapsules = [];

const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      isMongoConnected = true;
      CapsuleModel = require('./models/capsule');
      console.log('✓ Connected to MongoDB Atlas with 2dsphere indexing support');
    })
    .catch((err) => {
      console.warn('! MongoDB connection failed, using in-memory fallback:', err.message);
      isMongoConnected = false;
    });
} else {
  console.log('! MONGODB_URI not set in environment, using in-memory spatial storage');
}

// ---------------- ROUTES ---------------- //

app.get('/api/health', async (req, res) => {
  let capsuleCount = memoryCapsules.length;
  if (isMongoConnected && CapsuleModel) {
    try {
      capsuleCount = await CapsuleModel.countDocuments();
    } catch (e) {}
  }
  res.json({
    status: 'ok',
    app: 'SoundCache API',
    mode: isMongoConnected ? 'MongoDB (2dsphere)' : 'In-Memory Spatial Engine',
    capsuleCount,
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

    let capsules = [];
    if (isMongoConnected && CapsuleModel) {
      capsules = await CapsuleModel.find({
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: maxDistance,
          },
        },
      })
        .select('-audioData -replies.audioData')
        .lean();
    } else {
      capsules = memoryCapsules.filter((cap) => {
        const [cLng, cLat] = cap.location.coordinates;
        const dist = calculateDistanceMeters(lat, lng, cLat, cLng);
        return dist <= maxDistance;
      });
    }

    const host = req.get('host');
    const baseUrl = `${req.protocol}://${host}`;

    const enrichedCapsules = capsules.map((cap) => {
      const [cLng, cLat] = cap.location.coordinates;
      const distanceMeters = calculateDistanceMeters(lat, lng, cLat, cLng);
      const isUnlocked = distanceMeters <= (cap.unlockRadius || 30);
      const rawReplies = cap.replies || [];

      const replies = isUnlocked
        ? rawReplies.map((r) => ({
            _id: r._id,
            author: r.author || 'Anonymous Explorer',
            duration: r.duration || 10,
            createdAt: r.createdAt,
            audioUrl: `${baseUrl}/api/capsules/${cap._id}/replies/${r._id}/audio`,
          }))
        : [];

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
        replyCount: rawReplies.length,
        replies,
        createdAt: cap.createdAt,
        distanceMeters,
        isUnlocked,
        audioUrl: isUnlocked ? `${baseUrl}/api/capsules/${cap._id}/audio` : null,
        previewAvailable: isUnlocked,
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

// GET /api/capsules/:id/audio
app.get('/api/capsules/:id/audio', async (req, res) => {
  try {
    let buffer = null;
    let contentType = 'audio/mp4';

    if (isMongoConnected && CapsuleModel) {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ error: 'Audio not found' });
      }
      const cap = await CapsuleModel.findById(req.params.id)
        .select('audioData audioMimeType')
        .lean();
      if (!cap || !cap.audioData) {
        return res.status(404).json({ error: 'Audio not found' });
      }
      buffer = Buffer.isBuffer(cap.audioData)
        ? cap.audioData
        : Buffer.from(cap.audioData.buffer || cap.audioData);
      contentType = cap.audioMimeType || 'audio/mp4';
    } else {
      const cap = memoryCapsules.find((c) => c._id === req.params.id);
      if (!cap || !cap.audioBuffer) {
        return res.status(404).json({ error: 'Audio not found' });
      }
      buffer = cap.audioBuffer;
      contentType = cap.audioMimeType || 'audio/mp4';
    }

    return streamAudioBuffer(req, res, buffer, contentType);
  } catch (err) {
    console.error('Error streaming audio:', err);
    res.status(500).json({ error: 'Failed to stream audio' });
  }
});

// GET /api/capsules/:id/replies/:replyId/audio — stream guestbook reply audio
app.get('/api/capsules/:id/replies/:replyId/audio', async (req, res) => {
  try {
    let buffer = null;
    let contentType = 'audio/mp4';

    if (isMongoConnected && CapsuleModel) {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ error: 'Reply audio not found' });
      }
      const cap = await CapsuleModel.findById(req.params.id)
        .select('replies')
        .lean();
      const reply = cap?.replies?.find((r) => String(r._id) === req.params.replyId);
      if (!reply || !reply.audioData) {
        return res.status(404).json({ error: 'Reply audio not found' });
      }
      buffer = Buffer.isBuffer(reply.audioData)
        ? reply.audioData
        : Buffer.from(reply.audioData.buffer || reply.audioData);
      contentType = reply.audioMimeType || 'audio/mp4';
    } else {
      const cap = memoryCapsules.find((c) => c._id === req.params.id);
      const reply = cap?.replies?.find((r) => r._id === req.params.replyId);
      if (!reply || !reply.audioBuffer) {
        return res.status(404).json({ error: 'Reply audio not found' });
      }
      buffer = reply.audioBuffer;
      contentType = reply.audioMimeType || 'audio/mp4';
    }

    return streamAudioBuffer(req, res, buffer, contentType);
  } catch (err) {
    console.error('Error streaming reply audio:', err);
    res.status(500).json({ error: 'Failed to stream reply audio' });
  }
});

// POST /api/capsules/:id/replies — append a 10s Whisper Chain voice reply
app.post('/api/capsules/:id/replies', upload.single('audio'), async (req, res) => {
  try {
    const { author, duration } = req.body;

    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ error: 'Voice reply audio file is required' });
    }

    const audioMimeType = resolveMimeType(req.file);
    const parsedDuration = Math.min(10, Math.max(1, parseInt(duration, 10) || 10));
    const host = req.get('host');
    const baseUrl = `${req.protocol}://${host}`;

    if (isMongoConnected && CapsuleModel) {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ error: 'Capsule not found' });
      }
      const cap = await CapsuleModel.findById(req.params.id);
      if (!cap) return res.status(404).json({ error: 'Capsule not found' });

      const newReply = {
        author: (author || 'Anonymous Explorer').trim(),
        audioData: req.file.buffer,
        audioMimeType,
        duration: parsedDuration,
        createdAt: new Date(),
      };
      cap.replies.push(newReply);
      await cap.save();

      const savedReply = cap.replies[cap.replies.length - 1];
      return res.status(201).json({
        _id: savedReply._id,
        author: savedReply.author,
        duration: savedReply.duration,
        createdAt: savedReply.createdAt,
        audioUrl: `${baseUrl}/api/capsules/${cap._id}/replies/${savedReply._id}/audio`,
      });
    } else {
      const cap = memoryCapsules.find((c) => c._id === req.params.id);
      if (!cap) return res.status(404).json({ error: 'Capsule not found' });

      const replyId = 'rep-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const newReply = {
        _id: replyId,
        author: (author || 'Anonymous Explorer').trim(),
        audioBuffer: req.file.buffer,
        audioMimeType,
        duration: parsedDuration,
        createdAt: new Date(),
      };
      cap.replies = cap.replies || [];
      cap.replies.push(newReply);

      return res.status(201).json({
        _id: replyId,
        author: newReply.author,
        duration: newReply.duration,
        createdAt: newReply.createdAt,
        audioUrl: `${baseUrl}/api/capsules/${cap._id}/replies/${replyId}/audio`,
      });
    }
  } catch (err) {
    console.error('Error adding voice reply:', err);
    res.status(500).json({ error: 'Failed to save voice reply' });
  }
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
    let savedId = null;
    let savedCapsule = null;

    if (isMongoConnected && CapsuleModel) {
      const doc = new CapsuleModel({
        title: title.trim(),
        author: (author || 'Anonymous Explorer').trim(),
        category: category || 'Story',
        duration: duration ? parseInt(duration, 10) : 15,
        audioData: req.file.buffer,
        audioMimeType,
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        unlockRadius: 30,
        listens: 0,
        likes: 0,
        description: description || '',
        replies: [],
      });
      savedCapsule = await doc.save();
      savedId = savedCapsule._id.toString();
    } else {
      savedId = 'cap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      savedCapsule = {
        _id: savedId,
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
        replies: [],
        createdAt: new Date(),
      };
      memoryCapsules.push(savedCapsule);
    }

    const host = req.get('host');
    const baseUrl = `${req.protocol}://${host}`;

    res.status(201).json({
      _id: savedId,
      title: savedCapsule.title,
      author: savedCapsule.author,
      category: savedCapsule.category,
      duration: savedCapsule.duration,
      unlockRadius: savedCapsule.unlockRadius,
      listens: 0,
      likes: 0,
      replyCount: 0,
      replies: [],
      createdAt: savedCapsule.createdAt,
      audioUrl: `${baseUrl}/api/capsules/${savedId}/audio`,
      hasAudio: true,
    });
  } catch (err) {
    console.error('Error creating capsule:', err);
    res.status(500).json({ error: 'Failed to save capsule' });
  }
});

// POST /api/capsules/:id/like
app.post('/api/capsules/:id/like', async (req, res) => {
  try {
    if (isMongoConnected && CapsuleModel) {
      const updated = await CapsuleModel.findByIdAndUpdate(
        req.params.id,
        { $inc: { likes: 1 } },
        { new: true }
      ).select('likes');
      if (!updated) return res.status(404).json({ error: 'Capsule not found' });
      return res.json({ likes: updated.likes });
    }
    const cap = memoryCapsules.find((c) => c._id === req.params.id);
    if (cap) {
      cap.likes = (cap.likes || 0) + 1;
      return res.json({ likes: cap.likes });
    }
    return res.status(404).json({ error: 'Capsule not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update like' });
  }
});

// POST /api/capsules/:id/listen
app.post('/api/capsules/:id/listen', async (req, res) => {
  try {
    if (isMongoConnected && CapsuleModel) {
      const updated = await CapsuleModel.findByIdAndUpdate(
        req.params.id,
        { $inc: { listens: 1 } },
        { new: true }
      ).select('listens');
      if (!updated) return res.status(404).json({ error: 'Capsule not found' });
      return res.json({ listens: updated.listens });
    }
    const cap = memoryCapsules.find((c) => c._id === req.params.id);
    if (cap) {
      cap.listens = (cap.listens || 0) + 1;
      return res.json({ listens: cap.listens });
    }
    return res.status(404).json({ error: 'Capsule not found' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update listen count' });
  }
});

// DELETE /api/capsules/:id
app.delete('/api/capsules/:id', async (req, res) => {
  try {
    if (isMongoConnected && CapsuleModel) {
      const deleted = await CapsuleModel.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Capsule not found' });
      return res.json({ message: 'Capsule deleted' });
    }
    const idx = memoryCapsules.findIndex((c) => c._id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Capsule not found' });
    }
    memoryCapsules.splice(idx, 1);
    res.json({ message: 'Capsule deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete capsule' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SoundCache Spatial API running on port ${PORT}`);
  });
}

module.exports = app;
