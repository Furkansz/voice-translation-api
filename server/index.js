const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const config = require('./config');
const VoiceCloneService = require('./services/voiceCloneService');
const TranscriptionService = require('./services/transcriptionService');
const TranslationService = require('./services/translationService');
const SpeechSynthesisService = require('./services/speechSynthesisService');
const SessionManager = require('./services/sessionManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files only if build directory exists (avoid 404 in development)
const buildPath = path.join(__dirname, '../client/build');
if (require('fs').existsSync(buildPath)) {
  app.use(express.static(buildPath));
  console.log('📁 Serving static files from build directory');
} else {
  console.log('📁 Build directory not found - running in development mode');
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Initialize services
const voiceCloneService = new VoiceCloneService(config);
const transcriptionService = new TranscriptionService(config);
const translationService = new TranslationService(config);
const speechSynthesisService = new SpeechSynthesisService(config);
const sessionManager = new SessionManager();

// Initialize streaming services for real-time translation
const StreamingTranslationPipeline = require('./services/streamingTranslationPipeline');
const streamingPipeline = new StreamingTranslationPipeline(config);

// Routes
app.post('/api/upload-voice', upload.single('voiceFile'), async (req, res) => {
  try {
    console.log('📤 Voice upload request received:', {
      body: req.body,
      file: req.file ? { name: req.file.originalname, size: req.file.size } : null
    });
    
    const { language, role } = req.body;
    const voiceFile = req.file;
    
    if (!voiceFile) {
      console.error('❌ No voice file in upload request');
      return res.status(400).json({ error: 'No voice file uploaded' });
    }
    
    if (!language || !role) {
      console.error('❌ Missing language or role:', { language, role });
      return res.status(400).json({ error: 'Language and role are required' });
    }
    
    console.log(`🎤 Processing voice clone for ${role} in ${language}`);
    console.log(`📁 File details:`, {
      path: voiceFile.path,
      size: voiceFile.size,
      mimetype: voiceFile.mimetype
    });
    
    // Clone the voice using ElevenLabs
    const voiceId = await voiceCloneService.cloneVoice(voiceFile.path, `${role}-voice`);
    
    if (!voiceId) {
      console.error('❌ Voice cloning service returned null/undefined');
      return res.status(500).json({ error: 'Failed to clone voice - service returned no voice ID' });
    }
    
    console.log(`✅ Voice cloned successfully with ID: ${voiceId}`);
    
    // Clean up uploaded file
    try {
      fs.unlinkSync(voiceFile.path);
      console.log(`🗑️ Cleaned up uploaded file: ${voiceFile.path}`);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup uploaded file:', cleanupError);
    }
    
    res.json({
      success: true,
      voiceId: voiceId,
      message: 'Voice cloned successfully'
    });
    
  } catch (error) {
    console.error('❌ Voice upload error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Cleaned up file after error');
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup file after error:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      error: error.message || 'Voice cloning failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve React app for all other routes (only if build exists)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../client/build/index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // In development, don't serve static files
    res.status(404).json({ 
      error: 'Route not found', 
      message: 'This is a development server. Use the React dev server for the frontend.',
      availableRoutes: ['/api/upload-voice', '/api/health']
    });
  }
});

// WebSocket connection handling with heartbeat
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Set up Socket.IO heartbeat to detect dead connections
  socket.isAlive = true;
  
  // Custom heartbeat using Socket.IO events
  socket.on('heartbeat-pong', () => {
    socket.isAlive = true;
  });
  
  // Send heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    if (socket.isAlive === false) {
      console.log('💔 Client failed heartbeat, disconnecting:', socket.id);
      socket.disconnect(true);
      return;
    }
    socket.isAlive = false;
    socket.emit('heartbeat-ping');
  }, 30000);
  
  socket.on('join-session', async (data) => {
    try {
      const { role, language, voiceId } = data;
      
      console.log(`👤 User joining session: ${role} (${language}) with voice ${voiceId}, socket: ${socket.id}`);
      
      if (!role || !language || !voiceId) {
        console.error('❌ Missing required fields:', { role, language, voiceId });
        socket.emit('error', { message: 'Role, language, and voiceId are required' });
        return;
      }
      
      // Add user to session
      const session = await sessionManager.addUser(socket.id, {
        role,
        language,
        voiceId,
        socket
      });
      
      console.log(`✅ User added to session ${session.id}`);
      
      socket.emit('session-joined', { 
        sessionId: session.id,
        role,
        language 
      });
      
      // If both doctor and patient are connected, start the session
      if (session.doctor && session.patient && session.doctor.socket && session.patient.socket) {
        console.log(`🎉 Session ${session.id} has both participants - starting streaming translation`);
        
        // Start streaming translation for doctor
        const doctorStreamingStarted = await streamingPipeline.startTranslationSession(
          session.id,
          session.doctor.socket.id,
          session.doctor.language,
          session.patient.language,
          session.patient.voiceId,
          session.doctor.socket,
          'doctor'
        );
        
        // Start streaming translation for patient
        const patientStreamingStarted = await streamingPipeline.startTranslationSession(
          session.id,
          session.patient.socket.id,
          session.patient.language,
          session.doctor.language,
          session.doctor.voiceId,
          session.patient.socket,
          'patient'
        );
        
        if (doctorStreamingStarted && patientStreamingStarted) {
          console.log(`✅ Real-time streaming translation active for session ${session.id}`);
          
          // Notify both participants that real-time session is ready
          io.to(session.doctor.socket.id).emit('session-ready', {
            partnerLanguage: session.patient.language,
            partnerRole: 'patient',
            streamingActive: true
          });
          
          io.to(session.patient.socket.id).emit('session-ready', {
            partnerLanguage: session.doctor.language,
            partnerRole: 'doctor',
            streamingActive: true
          });
        } else {
          console.error(`❌ Failed to start streaming translation for session ${session.id}`);
          session.doctor.socket.emit('error', { message: 'Failed to start real-time translation' });
          session.patient.socket.emit('error', { message: 'Failed to start real-time translation' });
        }
        
      } else {
        const waitingFor = role === 'doctor' ? 'patient' : 'doctor';
        console.log(`⏳ Waiting for ${waitingFor} to join session ${session.id}`);
        socket.emit('waiting-for-partner', { role: waitingFor });
      }
      
    } catch (error) {
      console.error('❌ Join session error:', error);
      socket.emit('error', { message: error.message });
    }
  });
  
  // Real-time streaming audio handler
    socket.on('streaming-audio', async (data) => {
    try {
      const { audioData } = data;
      
      console.log(`🎙️ Streaming audio from ${socket.id}: ${audioData?.length || 0} bytes`);
      
      // Send audio directly to streaming pipeline
      const processed = await streamingPipeline.processAudioData(socket.id, audioData);
      
      if (!processed) {
        console.warn(`⚠️ Failed to process streaming audio for ${socket.id}`);
      }
      
    } catch (error) {
      console.error(`❌ Streaming audio error for ${socket.id}:`, error);
      socket.emit('streaming-error', { message: 'Real-time audio processing failed' });
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
    
    // Stop streaming translation for this user
    streamingPipeline.stopTranslationSession(socket.id);
    
    // Clean up heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    // Get user info before removal
    const user = sessionManager.getUser(socket.id);
    if (user) {
      console.log(`👋 ${user.role} (${user.language}) disconnected from session ${user.sessionId}`);
      
      // Notify partner if in active session
      const partner = sessionManager.getPartnerInfo(socket.id);
      if (partner) {
        const session = sessionManager.getSession(user.sessionId);
        if (session) {
          const partnerSocket = user.role === 'doctor' ? session.patient?.socket : session.doctor?.socket;
          if (partnerSocket) {
            partnerSocket.emit('partner-disconnected', {
              message: `${user.role} disconnected`,
              reason: reason
            });
          }
        }
      }
    }
    
    sessionManager.removeUser(socket.id);
  });
});

// Real-time audio processing pipeline optimized for speed
async function processAudioPipeline(audioData, speaker, listener, session) {
  try {
    const startTime = Date.now();
    
    // Validate audio data size (relaxed for real-time)
    if (!audioData || (typeof audioData === 'string' && audioData.length < 500)) {
      console.log('⚠️ Skipping too small audio chunk:', audioData?.length || 0, 'bytes');
      return;
    }
    
    console.log(`🎤 Processing audio from ${speaker.role} (${speaker.language}) -> ${listener.role} (${listener.language})`);
    
    // Ultra-short timeout for instant phone call experience
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Pipeline timeout - processing too slow')), 3000)
    );
    
    const pipelinePromise = processPipelineSteps(audioData, speaker, listener, session, startTime);
    
    await Promise.race([pipelinePromise, timeoutPromise]);
    
  } catch (error) {
    console.error('❌ Pipeline error:', error);
    
    // Emit error to both participants with more specific error info
    const errorMessage = error.message.includes('timeout') ? 
      'Processing timeout - please speak more clearly' : 
      'Translation failed - please try again';
      
    if (speaker && speaker.socket) {
      speaker.socket.emit('error', { message: errorMessage });
    }
    if (listener && listener.socket) {
      listener.socket.emit('error', { message: errorMessage });
    }
  }
}

async function processPipelineSteps(audioData, speaker, listener, session, startTime) {
  const stepTimes = { start: startTime };
  
  try {
    // Validate inputs
    if (!speaker || !listener || !speaker.socket || !listener.socket) {
      throw new Error('Invalid speaker or listener configuration');
    }

    console.log(`🎯 Starting pipeline: ${speaker.role}(${speaker.language}) -> ${listener.role}(${listener.language})`);

    // Step 1: Transcribe audio to text
    stepTimes.transcriptionStart = Date.now();
    const transcription = await transcriptionService.transcribe(audioData, speaker.language);
    stepTimes.transcriptionEnd = Date.now();
    
    if (!transcription || !transcription.text || transcription.text.trim().length === 0) {
      console.log('⚠️ Empty transcription result - skipping pipeline');
      return;
    }
    
    console.log(`📝 Transcription (${stepTimes.transcriptionEnd - stepTimes.transcriptionStart}ms): "${transcription.text}"`);
    
    // Emit live transcription to speaker (with error handling)
    try {
      speaker.socket.emit('live-transcription', {
        text: transcription.text,
        language: speaker.language,
        confidence: transcription.confidence
      });
    } catch (err) {
      console.error('Failed to emit transcription to speaker:', err);
    }
    
    // Step 2: Translate text
    stepTimes.translationStart = Date.now();
    const translation = await translationService.translate(
      transcription.text,
      speaker.language,
      listener.language
    );
    stepTimes.translationEnd = Date.now();
    
    if (!translation || translation.trim().length === 0) {
      throw new Error('Translation returned empty result');
    }
    
    console.log(`🌍 Translation (${stepTimes.translationEnd - stepTimes.translationStart}ms): "${translation}"`);
    
    // Emit live translation to both parties (with error handling)
    const translationData = {
      originalText: transcription.text,
      translatedText: translation,
      sourceLanguage: speaker.language,
      targetLanguage: listener.language
    };
    
    try {
      speaker.socket.emit('live-translation', translationData);
      listener.socket.emit('live-translation', translationData);
    } catch (err) {
      console.error('Failed to emit translation:', err);
    }
    
    // Step 3: Synthesize speech with cloned voice and emotion transfer
    stepTimes.synthesisStart = Date.now();
    const synthesizedAudio = await speechSynthesisService.synthesize(
      translation,
      listener.voiceId,
      listener.language,
      audioData // Original audio for prosody and emotion reference
    );
    stepTimes.synthesisEnd = Date.now();
    
    if (!synthesizedAudio) {
      throw new Error('Speech synthesis returned empty audio');
    }
    
    console.log(`🎵 Synthesis (${stepTimes.synthesisEnd - stepTimes.synthesisStart}ms): ${synthesizedAudio.length} bytes`);
    
    // Step 4: Send synthesized audio to listener (with error handling)
    try {
      listener.socket.emit('synthesized-audio', {
        audioData: synthesizedAudio,
        text: translation,
        language: listener.language
      });
    } catch (err) {
      console.error('Failed to emit synthesized audio:', err);
    }
    
    const endTime = Date.now();
    const totalLatency = endTime - startTime;
    
    // Detailed performance stats
    const performanceStats = {
      totalLatency,
      transcriptionTime: stepTimes.transcriptionEnd - stepTimes.transcriptionStart,
      translationTime: stepTimes.translationEnd - stepTimes.translationStart,
      synthesisTime: stepTimes.synthesisEnd - stepTimes.synthesisStart,
      timestamp: endTime
    };
    
    console.log(`📊 Pipeline performance:`, performanceStats);
    
    // Emit latency statistics (with error handling)
    try {
      speaker.socket.emit('latency-stats', performanceStats);
      listener.socket.emit('latency-stats', performanceStats);
    } catch (err) {
      console.error('Failed to emit latency stats:', err);
    }
    
    if (totalLatency > config.MAX_LATENCY_MS) {
      console.warn(`⚠️ High latency detected: ${totalLatency}ms (target: ${config.MAX_LATENCY_MS}ms)`);
    } else {
      console.log(`✅ Pipeline completed successfully in ${totalLatency}ms`);
    }
    
  } catch (error) {
    const errorTime = Date.now();
    const errorLatency = errorTime - startTime;
    
    console.error(`❌ Pipeline failed after ${errorLatency}ms:`, error);
    
    // Emit detailed error to both parties (with error handling)
    const errorMessage = error.message.includes('timeout') ? 
      'Processing timeout - please speak more clearly and ensure good connection' : 
      `Translation failed: ${error.message}`;
      
    try {
      if (speaker && speaker.socket) {
        speaker.socket.emit('error', { 
          message: errorMessage,
          type: 'pipeline_error',
          step: error.step || 'unknown',
          latency: errorLatency
        });
      }
    } catch (err) {
      console.error('Failed to emit error to speaker:', err);
    }
    
    try {
      if (listener && listener.socket) {
        listener.socket.emit('error', { 
          message: errorMessage,
          type: 'pipeline_error',
          step: error.step || 'unknown',
          latency: errorLatency
        });
      }
    } catch (err) {
      console.error('Failed to emit error to listener:', err);
    }
  }
}

// Start server with error handling
const startServer = () => {
  server.listen(config.PORT, () => {
    console.log(`🚀 Server running on port ${config.PORT}`);
    console.log(`📦 Environment: ${config.NODE_ENV}`);
    console.log(`🔑 Deepgram API Key: ${config.DEEPGRAM_API_KEY ? config.DEEPGRAM_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
    console.log(`🔑 ElevenLabs API Key: ${config.ELEVENLABS_API_KEY ? config.ELEVENLABS_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
    console.log(`🎤 Voice Translation System Ready!`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`❌ Port ${config.PORT} is already in use`);
      console.log(`🔄 Trying port ${config.PORT + 1}...`);
      config.PORT = config.PORT + 1;
      setTimeout(startServer, 1000);
    } else {
      console.error('❌ Server error:', error);
    }
  });
};

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.log('\n🔌 Gracefully shutting down server...');
  streamingPipeline.shutdown();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🔌 Gracefully shutting down server (SIGTERM)...');
  streamingPipeline.shutdown();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer();

module.exports = app;
