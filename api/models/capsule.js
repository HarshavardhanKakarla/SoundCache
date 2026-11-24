const mongoose = require('mongoose');

const capsuleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  author: {
    type: String,
    default: 'Anonymous Explorer',
    trim: true,
  },
  category: {
    type: String,
    enum: ['Story', 'Secret', 'Music', 'Vibe', 'History', 'Whisper'],
    default: 'Story',
  },
  audioUrl: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    default: 15, // seconds
  },
  // GeoJSON Point for MongoDB 2dsphere indexing
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  unlockRadius: {
    type: Number,
    default: 30, // in meters
  },
  listens: {
    type: Number,
    default: 0,
  },
  likes: {
    type: Number,
    default: 0,
  },
  description: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create 2dsphere index for high-speed spatial proximity queries
capsuleSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Capsule', capsuleSchema);

