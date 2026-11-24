/**
 * Standalone seed script for SoundCache
 * Usage: node seed.js [lat] [lng]
 */
const mongoose = require('mongoose');
const Capsule = require('./models/capsule');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/soundcache';

const centerLat = parseFloat(process.argv[2]) || 17.3850;
const centerLng = parseFloat(process.argv[3]) || 78.4867;

const sampleCapsules = [
  {
    title: 'Secret Underground Jazz Vault',
    author: 'VinylSeeker',
    category: 'Music',
    duration: 28,
    audioUrl: '/uploads/demo-sound.mp3',
    location: {
      type: 'Point',
      coordinates: [centerLng + 0.0001, centerLat + 0.00012], // ~15m (UNLOCKED)
    },
    unlockRadius: 30,
    listens: 42,
    likes: 19,
    description: 'Listen to the acoustic resonance of this alleyway.',
  },
  {
    title: 'Late Night Library Echo',
    author: 'ScholarGhost',
    category: 'Whisper',
    duration: 15,
    audioUrl: '/uploads/demo-sound.mp3',
    location: {
      type: 'Point',
      coordinates: [centerLng - 0.00015, centerLat + 0.0001], // ~20m (UNLOCKED)
    },
    unlockRadius: 30,
    listens: 88,
    likes: 34,
    description: 'Turn off your screen and hear the book rustle from 2 AM.',
  },
  {
    title: 'The Clocktower Legend (1912)',
    author: 'Archivist_May',
    category: 'History',
    duration: 30,
    audioUrl: '/uploads/demo-sound.mp3',
    location: {
      type: 'Point',
      coordinates: [centerLng + 0.0006, centerLat + 0.0005], // ~80m (LOCKED)
    },
    unlockRadius: 30,
    listens: 12,
    likes: 5,
    description: 'Walk within 30m of the old clock to unlock the original bell chime.',
  },
  {
    title: 'Unsent Voice Note to My Ex',
    author: 'BrokenFrequency',
    category: 'Confession',
    category: 'Story',
    duration: 24,
    audioUrl: '/uploads/demo-sound.mp3',
    location: {
      type: 'Point',
      coordinates: [centerLng - 0.0009, centerLat - 0.0007], // ~130m (LOCKED)
    },
    unlockRadius: 30,
    listens: 156,
    likes: 67,
    description: 'Recorded this on a cold Tuesday night. Couldn’t hit send.',
  },
  {
    title: 'Rooftop Wind Chimes at Dawn',
    author: 'AmbientAura',
    category: 'Vibe',
    duration: 20,
    audioUrl: '/uploads/demo-sound.mp3',
    location: {
      type: 'Point',
      coordinates: [centerLng + 0.0014, centerLat - 0.0011], // ~200m (LOCKED)
    },
    unlockRadius: 30,
    listens: 29,
    likes: 14,
    description: 'Pure calming frequencies captured 40 floors above street level.',
  },
];

async function runSeed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB. Seeding capsules around', centerLat, centerLng);
    await Capsule.deleteMany({});
    const inserted = await Capsule.insertMany(sampleCapsules);
    console.log(`Successfully seeded ${inserted.length} capsules!`);
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
}

runSeed();

