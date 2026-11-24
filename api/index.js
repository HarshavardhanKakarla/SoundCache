const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded audio files and web UI dashboard
app.use('/uploads', express.static(uploadDir));
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
app.use(express.static(publicDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Multer setup with optional fallback
let upload = {
  single: () => (req, res, next) => next(),
};

try {
  const multer = require('multer');
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname) || '.m4a';
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `capsule-${uniqueSuffix}${ext}`);
    },
  });

  upload = multer({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  });
} catch (e) {
  console.log('Multer not loaded yet, using multipart fallback');
}

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

// MongoDB Connection with In-Memory fallback store
let isMongoConnected = false;
let CapsuleModel = null;
const memoryCapsules = [];

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/soundcache';

mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 })
  .then(() => {
    isMongoConnected = true;
    CapsuleModel = require('./models/capsule');
    console.log('✓ Connected to MongoDB with 2dsphere indexing support');
  })
  .catch((err) => {
    console.log(
      '! MongoDB offline, switching to built-in high-performance in-memory spatial storage'
    );
    isMongoConnected = false;
  });

// Generate default audio file for sample/mock seeds if needed
const sampleAudioPath = path.join(uploadDir, 'demo-sound.mp3');
if (!fs.existsSync(sampleAudioPath)) {
  // Simple silent MP3 frame placeholder (1 frame)
  const silentMp3 = Buffer.from([
    0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  fs.writeFileSync(sampleAudioPath, silentMp3);
}

// Helper to seed sample capsules around coordinates
function generateSampleCapsules(centerLat, centerLng) {
  const samples = [
    {
      title: 'Whispering Willow Secret',
      author: 'EchoSeeker',
      category: 'Secret',
      duration: 18,
      offset: { lat: 0.00012, lng: 0.00015 }, // ~15-20 meters away (UNLOCKED)
      description: 'Hidden memory left under the old oak tree.',
    },
    {
      title: 'Late Night Synthesizer Vibe',
      author: 'NeonBeat',
      category: 'Music',
      duration: 25,
      offset: { lat: 0.00018, lng: -0.00012 }, // ~22-26 meters away (UNLOCKED)
      description: '30 seconds of lofi ambient chords recorded right here.',
    },
    {
      title: 'Old Town Heritage Ghost Story',
      author: 'Historian_X',
      category: 'History',
      duration: 30,
      offset: { lat: 0.00055, lng: 0.00045 }, // ~75 meters away (LOCKED)
      description: 'What happened at this corner in 1947 will chill your spine.',
    },
    {
      title: 'Midnight Campus Confession',
      author: 'Anonymous',
      category: 'Story',
      duration: 22,
      offset: { lat: -0.00075, lng: 0.0006 }, // ~110 meters away (LOCKED)
      description: 'Never told anyone this until now. Walk closer to listen.',
    },
    {
      title: 'Morning Rain & Coffee Shop Vibe',
      author: 'CoffeeDrifter',
      category: 'Vibe',
      duration: 15,
      offset: { lat: 0.0012, lng: -0.001 }, // ~180 meters away (LOCKED)
      description: 'Rain hitting the street cafe awning with distant jazz.',
    },
  ];

  return samples.map((s, idx) => ({
    _id: 'sample-' + (Date.now() + idx),
    title: s.title,
    author: s.author,
    category: s.category,
    duration: s.duration,
    audioUrl: '/uploads/demo-sound.mp3',
    location: {
      type: 'Point',
      coordinates: [centerLng + s.offset.lng, centerLat + s.offset.lat],
    },
    unlockRadius: 30,
    listens: Math.floor(Math.random() * 45) + 3,
    likes: Math.floor(Math.random() * 20) + 1,
    description: s.description,
    createdAt: new Date(),
  }));
}

// ---------------- ROUTES ---------------- //

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SoundCache API',
    mode: isMongoConnected ? 'MongoDB (2dsphere)' : 'In-Memory Spatial Engine',
    uptime: process.uptime(),
  });
});

// GET /api/capsules/nearby?lat=...&lng=...&maxDistance=...
app.get('/api/capsules/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const maxDistance = parseFloat(req.query.maxDistance) || 5000; // in meters

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng query params are required' });
    }

    let capsules = [];

    if (isMongoConnected && CapsuleModel) {
      // Use MongoDB 2dsphere $near query
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
      }).lean();
    } else {
      // In-memory spatial filter using Haversine
      capsules = memoryCapsules.filter((cap) => {
        const [cLng, cLat] = cap.location.coordinates;
        const dist = calculateDistanceMeters(lat, lng, cLat, cLng);
        return dist <= maxDistance;
      });
    }

    // Attach exact distance and unlocked status
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    const enrichedCapsules = capsules.map((cap) => {
      const [cLng, cLat] = cap.location.coordinates;
      const distanceMeters = calculateDistanceMeters(lat, lng, cLat, cLng);
      const isUnlocked = distanceMeters <= (cap.unlockRadius || 30);

      // Format audioUrl with absolute host if relative
      let fullAudioUrl = cap.audioUrl;
      if (fullAudioUrl && fullAudioUrl.startsWith('/')) {
        fullAudioUrl = `${baseUrl}${fullAudioUrl}`;
      }

      return {
        ...cap,
        latitude: cLat,
        longitude: cLng,
        distanceMeters,
        isUnlocked,
        audioUrl: isUnlocked ? fullAudioUrl : null, // Protect locked audio URL!
        previewAvailable: isUnlocked,
      };
    });

    // Sort closest first
    enrichedCapsules.sort((a, b) => a.distanceMeters - b.distanceMeters);

    res.json({
      count: enrichedCapsules.length,
      userLocation: { latitude: lat, longitude: lng },
      unlockThresholdMeters: 30,
      capsules: enrichedCapsules,
    });
  } catch (err) {
    console.error('Error fetching nearby capsules:', err);
    res.status(500).json({ error: 'Failed to fetch capsules', details: err.message });
  }
});

// GET /api/capsules/all
app.get('/api/capsules/all', async (req, res) => {
  try {
    let capsules = [];
    if (isMongoConnected && CapsuleModel) {
      capsules = await CapsuleModel.find().sort({ createdAt: -1 }).lean();
    } else {
      capsules = [...memoryCapsules].reverse();
    }
    res.json({ count: capsules.length, capsules });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve capsules' });
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
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Determine audio file URL
    let audioUrl = '/uploads/demo-sound.mp3';
    if (req.file) {
      audioUrl = `/uploads/${req.file.filename}`;
    }

    const newCapsuleData = {
      title: title.trim(),
      author: (author || 'Anonymous Explorer').trim(),
      category: category || 'Story',
      duration: duration ? parseInt(duration, 10) : 15,
      audioUrl: audioUrl,
      location: {
        type: 'Point',
        coordinates: [lng, lat], // GeoJSON order: [longitude, latitude]
      },
      unlockRadius: 30,
      listens: 0,
      likes: 0,
      description: description || '',
      createdAt: new Date(),
    };

    let savedCapsule = null;
    if (isMongoConnected && CapsuleModel) {
      const capsule = new CapsuleModel(newCapsuleData);
      savedCapsule = await capsule.save();
    } else {
      savedCapsule = {
        _id: 'cap-' + Date.now(),
        ...newCapsuleData,
      };
      memoryCapsules.push(savedCapsule);
    }

    console.log(`[SoundCache] Dropped new capsule "${title}" at [${lat}, ${lng}]`);

    const host = req.get('host');
    const baseUrl = `${req.protocol}://${host}`;
    const responsePayload = {
      ... (savedCapsule.toObject ? savedCapsule.toObject() : savedCapsule),
      audioUrl: `${baseUrl}${audioUrl}`,
      latitude: lat,
      longitude: lng,
    };

    res.status(201).json(responsePayload);
  } catch (err) {
    console.error('Error creating capsule:', err);
    res.status(500).json({ error: 'Failed to save capsule', details: err.message });
  }
});

// POST /api/capsules/:id/like
app.post('/api/capsules/:id/like', async (req, res) => {
  const { id } = req.params;
  try {
    if (isMongoConnected && CapsuleModel) {
      const updated = await CapsuleModel.findByIdAndUpdate(
        id,
        { $inc: { likes: 1 } },
        { new: true }
      );
      return res.json({ likes: updated ? updated.likes : 1 });
    } else {
      const cap = memoryCapsules.find((c) => c._id === id);
      if (cap) {
        cap.likes = (cap.likes || 0) + 1;
        return res.json({ likes: cap.likes });
      }
      return res.status(404).json({ error: 'Capsule not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update like' });
  }
});

// POST /api/capsules/:id/listen
app.post('/api/capsules/:id/listen', async (req, res) => {
  const { id } = req.params;
  try {
    if (isMongoConnected && CapsuleModel) {
      const updated = await CapsuleModel.findByIdAndUpdate(
        id,
        { $inc: { listens: 1 } },
        { new: true }
      );
      return res.json({ listens: updated ? updated.listens : 1 });
    } else {
      const cap = memoryCapsules.find((c) => c._id === id);
      if (cap) {
        cap.listens = (cap.listens || 0) + 1;
        return res.json({ listens: cap.listens });
      }
      return res.status(404).json({ error: 'Capsule not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update listen count' });
  }
});

// POST /api/capsules/seed
// Automatically populates sample capsules around provided or default coordinates
app.post('/api/capsules/seed', async (req, res) => {
  try {
    const lat = parseFloat(req.body.latitude) || 17.3850; // default Hyderabad or any user coord
    const lng = parseFloat(req.body.longitude) || 78.4867;

    const samples = generateSampleCapsules(lat, lng);

    if (isMongoConnected && CapsuleModel) {
      await CapsuleModel.deleteMany({});
      await CapsuleModel.insertMany(samples.map(({ _id, ...rest }) => rest));
    } else {
      memoryCapsules.length = 0;
      memoryCapsules.push(...samples);
    }

    res.json({
      message: 'Successfully seeded capsules around location',
      center: { latitude: lat, longitude: lng },
      count: samples.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Seeding failed', details: err.message });
  }
});

// Pre-seed initial sample capsules so the app is immediately populated out-of-the-box
const initialSamples = generateSampleCapsules(17.3850, 78.4867);
memoryCapsules.push(...initialSamples);

// Start HTTP server only when run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🎧 SoundCache Spatial API running on port ${PORT}`);
    console.log(`📡 Endpoints:`);
    console.log(`   GET  /api/health`);
    console.log(`   GET  /api/capsules/nearby?lat=..&lng=..`);
    console.log(`   POST /api/capsules`);
    console.log(`   POST /api/capsules/seed`);
    console.log(`===============================================`);
  });
}

module.exports = app;
