import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  videoUrl: {
    type: String,
    required: true
  },
  audioUrl: {
    type: String,
    required: true
  },
  transcript: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: 'en'
  },
  cloudinaryVideoId: { // Add this field
    type: String,
    required: false // change to false
  },
  cloudinaryAudioId: { // Add this field
    type: String,
    required: false // change to false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Video = mongoose.model('Video', videoSchema);

export default Video;