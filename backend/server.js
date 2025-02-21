import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';  
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mongoose from 'mongoose';
import Video from './models/Video.js';
import { pipeline } from '@xenova/transformers';

import Groq from "groq-sdk";
dotenv.config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
// ES Module fixes
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Setup directories
const TRANSCRIBE_SCRIPT = path.join(__dirname, 'whisper_transcribe.py');
const tempDir = path.join(__dirname, 'temp');
const modelDir = path.join(__dirname, '.model');

[tempDir, modelDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer
const storage = multer.diskStorage({
  destination: tempDir,
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Helper functions
const uploadToCloudinary = async (filePath, options) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
};

const transcribeAudio = (audioPath, language = null) => {
  return new Promise((resolve, reject) => {
    const args = [TRANSCRIBE_SCRIPT, audioPath];
    if (language) args.push(language);

    const python = spawn('python', args, {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let transcriptData = null;

    python.stdout.on('data', (data) => {
      try {
        const result = JSON.parse(data.toString());
        transcriptData = result;
      } catch (e) {
        console.error('Failed to parse transcript:', e);
      }
    });

    python.stderr.on('data', (data) => {
      if (!data.toString().includes('FP16')) {
        console.error(`Transcription Error: ${data}`);
      }
    });

    python.on('close', (code) => {
      if (code !== 0 || !transcriptData) {
        reject(new Error(`Transcription failed with code ${code}`));
        return;
      }
      resolve(transcriptData);
    });
  });
};
// Routes
app.post('/upload', upload.single('video'), async (req, res) => {
  const videoPath = req.file.path;
  const audioPath = path.join(tempDir, `${Date.now()}-audio.mp3`);

  try {
    // 1. Upload video to Cloudinary
    const videoResult = await uploadToCloudinary(videoPath, {
      resource_type: 'video',
      folder: 'videos'
    });

    // 2. Extract audio
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .toFormat('mp3')
        .on('end', resolve)
        .on('error', reject)
        .save(audioPath);
    });

    // 3. Upload audio
    const audioResult = await uploadToCloudinary(audioPath, {
      resource_type: 'raw',
      folder: 'audio'
    });

    // 4. Get transcript
    let transcriptionResult;
    try {
      transcriptionResult = await transcribeAudio(audioPath);
    } catch (error) {
      console.error("Transcription error:", error);
      transcriptionResult = { text: "" }; // Set transcript to empty string
    }

    let cloudinaryVideoId = videoResult.public_id;
    let cloudinaryAudioId = audioResult.public_id;

    // 5. Check for Empty Transcript
    if (!transcriptionResult.text) {
      cloudinaryVideoId = null;
      cloudinaryAudioId = null;
    }

    // 6. Save to MongoDB
    const video = await Video.create({
      videoUrl: videoResult.secure_url,
      audioUrl: audioResult.secure_url,
      transcript: transcriptionResult.text,
      language: transcriptionResult.language || 'en',
      cloudinaryVideoId: cloudinaryVideoId,
      cloudinaryAudioId: cloudinaryAudioId
    });

    res.json({
      success: true,
      data: {
        id: video._id,
        videoUrl: video.videoUrl,
        audioUrl: video.audioUrl,
        transcript: video.transcript,
        language: video.language
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Cleanup
    [videoPath, audioPath].forEach(file => {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch (err) {
          console.error(`Cleanup error for ${file}:`, err);
        }
      }
    });
  }
});

app.get('/videos', async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json({ success: true, data: videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.post('/qa', async (req, res) => {
  try {
    const { videoId, question } = req.body;

    console.log("Received QA request:", { videoId, question });

    const video = await Video.findById(videoId);
    if (!video) {
      console.log("Video not found for ID:", videoId);
      return res.status(404).json({ error: 'Video not found' });
    }

    
    // Use GroqCloud API to generate the answer
    const prompt = `You are a teacher. Act as if this video is your own. Answer the following question to the best of your ability, using the video's content as context. If the answer isn't directly in the video, use your expertise to provide a helpful and informative response. Answer the question directly and concisely, without asking any follow-up questions or mentioning the video or transcript.\n\nVideo Transcript: ${video.transcript}\nQuestion: ${question}`;    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "mixtral-8x7b-32768",
    });

    console.log("GroqCloud API Response Data:", chatCompletion.choices[0]?.message?.content);

    const answer = chatCompletion.choices[0]?.message?.content || "";

    res.json({
      success: true,
      data: {
        answer: answer,
        score: 1, // Since it's generative, we don't have a score
        start: 0,
        end: 0
      }
    });
  } catch (error) {
    console.error('QA Error:', error);
    res.status(500).json({ error: error.message });
  }
});
app.delete('/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(video.cloudinaryVideoId, { resource_type: 'video' });
      await cloudinary.uploader.destroy(video.cloudinaryAudioId, { resource_type: 'raw' });
    } catch (cloudinaryError) {
      console.error("Cloudinary deletion error:", cloudinaryError);
      return res.status(500).json({ success: false, message: 'Error deleting from Cloudinary' });
    }

    // Delete from MongoDB
    await Video.findByIdAndDelete(id);

    res.json({ success: true, message: 'Video deleted' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});