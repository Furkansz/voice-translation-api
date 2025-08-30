const StreamingTranscriptionService = require('./streamingTranscriptionService');
const StreamingSynthesisService = require('./streamingSynthesisService');
const TranslationService = require('./translationService');
const EmotionDetectionService = require('./emotionDetectionService');
const ProfessionalConversationProcessor = require('./professionalConversationProcessor');

class StreamingTranslationPipeline {
  constructor(config) {
    this.config = config;
    this.transcriptionService = new StreamingTranscriptionService(config);
    this.synthesisService = new StreamingSynthesisService(config);
    this.translationService = new TranslationService(config);
    this.emotionService = new EmotionDetectionService(config);
    
    // Initialize professional conversation processor for natural flow
    this.conversationProcessor = new ProfessionalConversationProcessor({
      conversationalPauseThreshold: 750,    // Natural conversation pause
      sentenceCompletionThreshold: 1200,    // Complete sentence pause  
      thoughtCompletionThreshold: 2000,     // Complete thought pause
      emergencyTimeout: 4000,               // Max wait time
      minConfidenceThreshold: 0.8,          // Higher confidence for professional use
      enableProfessionalTiming: true,       // Optimize for professional conversations
      enableMedicalContext: true,           // Medical conversation awareness
      adaptToSpeechPatterns: true           // Learn individual speech patterns
    });
    
    // Listen for professional speech completion events
    this.conversationProcessor.on('professional_speech_ready', async (data) => {
      console.log(`👨‍⚕️ Professional speech completed for ${data.userId}: "${data.text}"`);
      await this.processCompleteTranslation(data.userId, data.text, data.confidence);
    });
    
    this.activeSessions = new Map();
    this.partialTranslations = new Map();
    this.emotionalProfiles = new Map(); // Store current emotional state per user
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 30000);
  }

  /**
   * Start real-time translation session for a user
   */
  async startTranslationSession(sessionId, userId, userLanguage, partnerLanguage, partnerVoiceId, socket, role) {
    try {
      console.log(`🌍 Starting streaming translation session: ${userId} (${userLanguage} -> ${partnerLanguage})`);
      
      const sessionInfo = {
        sessionId,
        userId,
        userLanguage,
        partnerLanguage,
        partnerVoiceId,
        socket,
        role: role || null,
        isActive: true,
        startTime: Date.now(),
        lastActivity: Date.now(),
        partialBuffer: '',
        translationBuffer: [],
        stats: {
          audioChunks: 0,
          partialResults: 0,
          finalResults: 0,
          translations: 0,
          synthesisChunks: 0
        }
      };
      
             this.activeSessions.set(userId, sessionInfo);
       
       // Initialize professional conversation for this user
       const inferredRole = role || (userLanguage === 'tr' ? 'doctor' : 'patient');
       sessionInfo.role = inferredRole;
       this.conversationProcessor.initializeProfessionalConversation(userId, userLanguage, inferredRole);
       
       // Start streaming transcription
      const transcriptionStarted = await this.transcriptionService.startStreamingTranscription(
        userId,
        userLanguage,
        // Partial result handler
        (partialResult) => this.handlePartialTranscription(userId, partialResult),
        // Final result handler
        (finalResult) => this.handleFinalTranscription(userId, finalResult),
        // Error handler
        (error) => this.handleTranscriptionError(userId, error)
      );
      
      if (!transcriptionStarted) {
        throw new Error('Failed to start streaming transcription');
      }
      
      // Start synthesis stream
      const synthesisStarted = await this.synthesisService.startStreamingSynthesis(
        userId,
        partnerVoiceId,
        partnerLanguage,
        // Audio chunk handler
        (audioChunk) => this.handleSynthesisChunk(userId, audioChunk),
        // Complete handler
        (userId) => this.handleSynthesisComplete(userId),
        // Error handler
        (error) => this.handleSynthesisError(userId, error)
      );
      
      if (!synthesisStarted) {
        throw new Error('Failed to start streaming synthesis');
      }
      
      console.log(`✅ Streaming translation session started for ${userId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to start translation session for ${userId}:`, error);
      this.stopTranslationSession(userId);
      return false;
    }
  }

  /**
   * Process incoming real-time audio data with emotion detection
   */
  async processAudioData(userId, audioData) {
    const session = this.activeSessions.get(userId);
    
    if (!session || !session.isActive) {
      console.warn(`⚠️ No active session for audio from ${userId}`);
      return false;
    }

    try {
      // Send audio to streaming transcription
      const sent = this.transcriptionService.sendAudioData(userId, audioData);
      
      if (sent) {
        session.stats.audioChunks++;
        session.lastActivity = Date.now();
        
        // 🎯 UPDATE PARTNER'S ACTIVITY TOO (they're actively listening)
        const partnerSession = this.findPartnerSession(userId);
        if (partnerSession) {
          partnerSession.lastActivity = Date.now();
        }
        
        // Store audio for emotion analysis (collect recent samples)
        if (!session.audioBuffer) {
          session.audioBuffer = [];
        }
        
        // Keep last 5 seconds of audio for emotion analysis
        session.audioBuffer.push({
          data: audioData,
          timestamp: Date.now()
        });
        
        // Limit buffer size (remove old audio)
        const maxAge = 5000; // 5 seconds
        const now = Date.now();
        session.audioBuffer = session.audioBuffer.filter(
          sample => (now - sample.timestamp) < maxAge
        );
      }
      
      return sent;
      
    } catch (error) {
      console.error(`❌ Error processing audio for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Handle partial transcription results with professional processing
   */
  async handlePartialTranscription(userId, partialResult) {
    const session = this.activeSessions.get(userId);
    
    if (!session) return;

    try {
      session.stats.partialResults++;
      session.lastActivity = Date.now();
      
      // Send live transcription to client
      session.socket.emit('live-transcription', {
        text: partialResult.text,
        confidence: partialResult.confidence,
        language: partialResult.language,
        isPartial: true,
        timestamp: partialResult.timestamp
      });
      
      // Let professional conversation processor decide if/when to process
      await this.conversationProcessor.processProfessionalTranscription(userId, {
        text: partialResult.text,
        confidence: partialResult.confidence,
        isFinal: false,
        timestamp: partialResult.timestamp || Date.now()
      });
      
    } catch (error) {
      console.error(`❌ Error handling professional partial transcription for ${userId}:`, error);
    }
  }

  /**
   * Handle final transcription results with professional processing
   */
  async handleFinalTranscription(userId, finalResult) {
    const session = this.activeSessions.get(userId);
    
    if (!session) return;

    try {
      session.stats.finalResults++;
      session.lastActivity = Date.now();
      
      console.log(`📝 FINAL transcription for ${userId}: "${finalResult.text}"`);
      
      // Send final transcription to client
      session.socket.emit('live-transcription', {
        text: finalResult.text,
        confidence: finalResult.confidence,
        language: finalResult.language,
        isPartial: false,
        timestamp: finalResult.timestamp
      });
      
      // Let professional conversation processor handle with high confidence (it's marked as final)
      await this.conversationProcessor.processProfessionalTranscription(userId, {
        text: finalResult.text,
        confidence: Math.max(finalResult.confidence || 0.9, 0.8), // Boost confidence for final results
        isFinal: true,
        timestamp: finalResult.timestamp || Date.now()
      });
      
    } catch (error) {
      console.error(`❌ Error handling professional final transcription for ${userId}:`, error);
    }
  }

  /**
   * Process complete translation and synthesis (called by professional conversation processor)
   */
  async processCompleteTranslation(userId, text, confidence = 0.9) {
    const session = this.activeSessions.get(userId);
    
    if (!session) return;

    try {
      // Normalize to suppress duplicates like "hello" -> "hello," repeats
      const normalize = (s) => (s || '').trim().toLowerCase().replace(/[.,!?\s]+$/g, '');
      const normalized = normalize(text);
      const now = Date.now();
      if (session.lastProcessedNormalized === normalized && (now - (session.lastProcessedAt || 0)) < 3000) {
        console.log(`🔄 Duplicate text detected for ${userId}, skipping: "${text}"`);
        return;
      }
      session.lastProcessedNormalized = normalized;
      session.lastProcessedAt = now;

      const startTime = Date.now();
      
      // Translate the final text
      const translation = await this.translationService.translate(
        text,
        session.userLanguage,
        session.partnerLanguage
      );
      
      if (!translation.translatedText) {
        throw new Error('Translation service returned empty result');
      }
      
      session.stats.translations++;
      const translationTime = Date.now() - startTime;
      
      console.log(`🌍 Translation (${translationTime}ms): "${text}" -> "${translation.translatedText}"`);
      
      // 🎭 EMOTION DETECTION: Analyze emotional content from audio and text
      let emotionalProfile = null;
      try {
        // Combine recent audio samples for emotion analysis
        const recentAudio = session.audioBuffer ? 
          session.audioBuffer.map(sample => sample.data).join('') : null;
        
        if (recentAudio) {
          emotionalProfile = await this.emotionService.analyzeEmotionalContent(
            recentAudio,
            text,
            session.userLanguage,
            userId
          );
          
          // Store the current emotional state
          this.emotionalProfiles.set(userId, emotionalProfile);
          
          console.log(`🎭 Emotional analysis for ${userId}:`, {
            emotion: emotionalProfile.primaryEmotion,
            intensity: emotionalProfile.intensity.toFixed(2),
            confidence: emotionalProfile.confidence.toFixed(2),
            tonality: emotionalProfile.tonality
          });
        }
      } catch (emotionError) {
        console.warn(`⚠️ Emotion detection failed for ${userId}:`, emotionError.message);
        emotionalProfile = this.emotionService.getDefaultEmotionalProfile();
      }
      
      // Send final translation to both speaker and partner with emotional context
      const translationData = {
        originalText: text,
        translatedText: translation.translatedText,
        sourceLanguage: session.userLanguage,
        targetLanguage: session.partnerLanguage,
        confidence: translation.confidence || 0.9,
        isPartial: false,
        timestamp: Date.now(),
        speaker: 'self',
        // 🎭 EMOTIONAL CONTEXT
        emotion: emotionalProfile ? {
          primary: emotionalProfile.primaryEmotion,
          intensity: emotionalProfile.intensity,
          tonality: emotionalProfile.tonality,
          confidence: emotionalProfile.confidence
        } : null
      };
      
      session.socket.emit('live-translation', translationData);
      
      // Also send to partner for their UI with emotional context
      const partnerSession = this.findPartnerSession(userId);
      if (partnerSession && partnerSession.socket) {
        partnerSession.socket.emit('live-translation', {
          ...translationData,
          speaker: 'partner'
        });
      }
      
      // Start synthesis immediately with emotional voice settings
      console.log(`🎤 Starting synthesis for ${userId}: "${translation.translatedText}" in ${session.partnerLanguage}`);
      if (emotionalProfile) {
        console.log(`🎭 Applying emotional synthesis: ${emotionalProfile.primaryEmotion} (${emotionalProfile.intensity.toFixed(2)} intensity)`);
      }
      
      const synthesisStarted = await this.synthesisService.synthesizeText(
        userId,
        translation.translatedText,
        true, // isFinal
        emotionalProfile // 🎭 EMOTIONAL VOICE SETTINGS
      );
      
      if (!synthesisStarted) {
        console.warn(`⚠️ Failed to start synthesis for ${userId}`);
      } else {
        console.log(`✅ Synthesis started successfully for ${userId}`);
      }
      
      // Send latency stats
      session.socket.emit('latency-stats', {
        transcriptionTime: 0, // Real-time streaming
        translationTime: translationTime,
        totalLatency: Date.now() - startTime,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error(`❌ Complete translation error for ${userId}:`, error);
      session.socket.emit('pipeline-error', {
        error: 'Translation failed',
        details: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle synthesized audio chunks
   */
  handleSynthesisChunk(userId, audioChunk) {
    const session = this.activeSessions.get(userId);
    
    if (!session) return;

    try {
      session.stats.synthesisChunks++;
      session.lastActivity = Date.now();
      
      console.log(`🎵 Synthesized audio for ${userId} speaker`);
      
      // CRITICAL: Find the partner to send the audio to (not the speaker!)
      const partnerSession = this.findPartnerSession(userId);
      
      if (partnerSession && partnerSession.socket) {
        console.log(`🔊 Sending synthesized audio to PARTNER ${partnerSession.userId} (${audioChunk.audioData.length} bytes)`);
        
        // Send audio to the PARTNER for playback (not the original speaker)
        partnerSession.socket.emit('synthesized-audio', {
          audioData: audioChunk.audioData,
          text: audioChunk.text,
          isFinal: audioChunk.isFinal,
          timestamp: audioChunk.timestamp,
          speakerLanguage: session.userLanguage,
          partnerLanguage: partnerSession.userLanguage
        });
      } else {
        console.warn(`⚠️ No partner found for ${userId} to send synthesized audio`);
      }
      
    } catch (error) {
      console.error(`❌ Error handling synthesis chunk for ${userId}:`, error);
    }
  }

  /**
   * Handle synthesis completion
   */
  handleSynthesisComplete(userId) {
    const session = this.activeSessions.get(userId);
    
    if (session) {
      console.log(`✅ Synthesis complete for ${userId}`);
      session.lastActivity = Date.now();
    }
  }

  /**
   * Handle transcription errors
   */
  handleTranscriptionError(userId, error) {
    const session = this.activeSessions.get(userId);
    
    if (session) {
      console.error(`❌ Transcription error for ${userId}:`, error);
      session.socket.emit('transcription-error', {
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle synthesis errors
   */
  handleSynthesisError(userId, error) {
    const session = this.activeSessions.get(userId);
    
    if (session) {
      console.error(`❌ Synthesis error for ${userId}:`, error);
      session.socket.emit('synthesis-error', {
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Stop translation session for a user
   */
  stopTranslationSession(userId) {
    const session = this.activeSessions.get(userId);
    
    if (session) {
      console.log(`⏹️ Stopping translation session for ${userId}`);
      
      // Stop all services
      this.transcriptionService.stopStreamingTranscription(userId);
      this.synthesisService.stopStreamingSynthesis(userId);
      
      // Clean up professional conversation processor
      this.conversationProcessor.removeProfessionalConversation(userId);
      
      // Log session stats
      const duration = Date.now() - session.startTime;
      console.log(`📊 Session stats for ${userId}:`, {
        duration: `${duration}ms`,
        ...session.stats
      });
      
      this.activeSessions.delete(userId);
      this.emotionalProfiles.delete(userId); // 🎭 Clean up emotional state
    }
  }

  /**
   * Find partner session for a user (critical for sending synthesized audio to the right person)
   */
  findPartnerSession(userId) {
    const userSession = this.activeSessions.get(userId);
    if (!userSession) return null;
    
    // Find the other user in the same session
    for (const [partnerId, partnerSession] of this.activeSessions.entries()) {
      if (partnerId !== userId && 
          partnerSession.sessionId === userSession.sessionId &&
          partnerSession.isActive) {
        return partnerSession;
      }
    }
    
    return null;
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions() {
    const now = Date.now();
    const timeout = 180000; // 3 minute timeout (increased from 1 minute)
    
    for (const [userId, session] of this.activeSessions.entries()) {
      const timeSinceActivity = now - session.lastActivity;
      
      // Find partner session to check if conversation is still active
      const partnerSession = this.findPartnerSession(userId);
      const partnerTimeSinceActivity = partnerSession ? 
        (now - partnerSession.lastActivity) : timeout + 1000;
      
      // Only cleanup if BOTH participants are inactive for the timeout period
      const bothInactive = timeSinceActivity > timeout && partnerTimeSinceActivity > timeout;
      
      // Or if there's no partner and this session is inactive
      const noPartnerAndInactive = !partnerSession && timeSinceActivity > timeout;
      
      if (bothInactive || noPartnerAndInactive) {
        console.log(`🧹 Cleaning up inactive session for ${userId} (inactive: ${Math.round(timeSinceActivity/1000)}s, partner inactive: ${Math.round(partnerTimeSinceActivity/1000)}s)`);
        this.stopTranslationSession(userId);
      }
    }
    
    // Also cleanup services
    this.transcriptionService.cleanupInactiveConnections();
    this.synthesisService.cleanupInactiveStreams();
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      activeSessions: this.activeSessions.size,
      activeTranscriptions: this.transcriptionService.getActiveConnectionCount(),
      activeSynthesis: this.synthesisService.getActiveStreamCount()
    };
  }

  /**
   * Shutdown the pipeline
   */
  shutdown() {
    console.log('🔌 Shutting down streaming translation pipeline...');
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Stop all sessions
    for (const userId of this.activeSessions.keys()) {
      this.stopTranslationSession(userId);
    }
    
    // Shutdown services
    this.transcriptionService.shutdown();
    this.synthesisService.shutdown();
    
    // Clean up professional conversation processor
    this.conversationProcessor.removeAllListeners();
  }
}

module.exports = StreamingTranslationPipeline;
