const axios = require('axios');
const WebSocket = require('ws');

class StreamingSynthesisService {
  constructor(config) {
    this.config = config;
    this.activeStreams = new Map();
    this.requestCache = new Map(); // Cache to prevent duplicate requests
    this.rateLimitQueue = []; // Queue for rate-limited requests
    this.isProcessingQueue = false;
  }

  /**
   * Start streaming speech synthesis that can begin before full text is available
   */
  async startStreamingSynthesis(userId, voiceId, targetLanguage, onAudioChunk, onComplete, onError) {
    try {
      console.log(`🎤 Starting streaming synthesis for ${userId} with voice ${voiceId}`);
      
      // Check if stream already exists
      if (this.activeStreams.has(userId)) {
        console.warn(`⚠️ Synthesis stream already exists for ${userId}, replacing it`);
        this.activeStreams.delete(userId);
      }
      
      // Use ElevenLabs streaming API
      const streamUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
      
      const streamInfo = {
        userId,
        voiceId,
        targetLanguage,
        onAudioChunk,
        onComplete,
        onError,
        textBuffer: [],
        isActive: true,
        lastActivity: Date.now(),
        createdAt: Date.now()
      };
      
      this.activeStreams.set(userId, streamInfo);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to start streaming synthesis for ${userId}:`, error);
      onError(error);
      return false;
    }
  }

  /**
   * Add text to the synthesis queue - can be partial sentences with emotional context
   */
  async synthesizeText(userId, text, isFinal = false, emotionalProfile = null) {
    const streamInfo = this.activeStreams.get(userId);
    
    if (!streamInfo || !streamInfo.isActive) {
      console.warn(`⚠️ No active synthesis stream for ${userId}`);
      return false;
    }
    
    // Update activity timestamp when stream is accessed (not just when synthesizing)
    streamInfo.lastActivity = Date.now();

    try {
      console.log(`🎵 Synthesizing ${isFinal ? 'FINAL' : 'PARTIAL'} text for ${userId}: "${text}"`);
      
      // For real-time synthesis, we need to process text as soon as we have enough
      const minLength = 20; // Minimum characters before synthesis (rate limit protection)
      const minWords = 4; // Minimum words before synthesis
      const wordCount = text.trim().split(/\s+/).length;
      const shouldSynthesize = isFinal || (text.length >= minLength && wordCount >= minWords);
      
      if (shouldSynthesize && text.trim()) {
        // 🎭 Log emotional context if available
        if (emotionalProfile) {
          console.log(`🎭 Emotional synthesis: ${emotionalProfile.primaryEmotion} @ ${emotionalProfile.intensity.toFixed(2)} intensity`);
        }
        
        const synthesizedAudio = await this.synthesizeChunk(
          streamInfo.voiceId, 
          text, 
          streamInfo.targetLanguage,
          emotionalProfile // 🎭 Pass emotional voice settings
        );
        
        if (synthesizedAudio) {
          streamInfo.onAudioChunk({
            audioData: synthesizedAudio,
            text: text,
            isFinal: isFinal,
            userId: userId,
            timestamp: Date.now()
          });
          
          if (isFinal) {
            streamInfo.onComplete(userId);
          }
        }
        
        streamInfo.lastActivity = Date.now();
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Synthesis error for ${userId}:`, error);
      streamInfo.onError(error);
      return false;
    }
  }

  /**
   * Synthesize a chunk of text using ElevenLabs with rate limit handling and emotional voice settings
   */
  async synthesizeChunk(voiceId, text, language, emotionalProfile = null) {
    const trimmedText = text.trim();
    
    // Create cache key that includes emotional state for more accurate caching
    const emotionKey = emotionalProfile ? 
      `${emotionalProfile.primaryEmotion}-${emotionalProfile.intensity.toFixed(1)}` : 'neutral';
    const cacheKey = `${voiceId}-${trimmedText}-${language}-${emotionKey}`;
    
    // Check cache to prevent duplicate requests within 5 seconds (increased window)
    const now = Date.now();
    const cached = this.requestCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < 5000) {
      console.log(`🔄 Using cached synthesis for: "${trimmedText}" (${emotionKey})`);
      return cached.result;
    }
    
    // Additional duplicate prevention - check for similar text regardless of emotions
    const baseTextKey = `${voiceId}-${trimmedText}-${language}`;
    for (const [key, value] of this.requestCache.entries()) {
      if (key.startsWith(baseTextKey) && (now - value.timestamp) < 3000) {
        console.log(`🔄 Preventing duplicate synthesis for similar text: "${trimmedText}"`);
        return value.result;
      }
    }
    
    try {
      const result = await this.synthesizeWithRetry(voiceId, trimmedText, language, emotionalProfile, 3);
      
      // Cache successful result
      this.requestCache.set(cacheKey, {
        result,
        timestamp: now
      });
      
      // Clean old cache entries
      this.cleanCache();
      
      return result;
      
    } catch (error) {
      console.error(`❌ ElevenLabs synthesis error after retries:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Synthesize with exponential backoff retry for rate limiting and emotional voice settings
   */
  async synthesizeWithRetry(voiceId, text, language, emotionalProfile = null, maxRetries = 3, retryDelay = 1000) {
    // 🎭 Apply ElevenLabs v3 audio tags for emotional expression
    let enhancedText = text;
    if (emotionalProfile && emotionalProfile.primaryEmotion) {
      enhancedText = this.applyEmotionalTags(text, emotionalProfile);
    }
    
    // 🎭 Use emotional voice settings if available, otherwise use language-optimized settings
    const voiceSettings = emotionalProfile && emotionalProfile.voiceSettings ? 
      emotionalProfile.voiceSettings : 
      this.getOptimizedSettings(language);
      
      const requestData = {
      text: enhancedText, // Use enhanced text with emotional tags
        model_id: this.getModelForLanguage(language),
        voice_settings: voiceSettings,
        optimize_streaming_latency: 2 // Optimize for real-time applications
      };

    // 🎭 Log emotional synthesis details
    if (emotionalProfile) {
      console.log(`🎭 Emotional Voice Settings Applied:`, {
        emotion: emotionalProfile.primaryEmotion,
        intensity: emotionalProfile.intensity.toFixed(2),
        stability: voiceSettings.stability.toFixed(2),
        style: voiceSettings.style.toFixed(2),
        similarity_boost: voiceSettings.similarity_boost.toFixed(2)
      });
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        requestData,
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.config.ELEVENLABS_API_KEY
          },
          responseType: 'arraybuffer',
            timeout: 15000 // Increased timeout for retries
        }
      );

      if (response.data && response.data.byteLength > 0) {
        // Convert to base64 for transmission
        const audioBase64 = Buffer.from(response.data).toString('base64');
          console.log(`✅ Synthesized ${text.length} chars -> ${response.data.byteLength} bytes (attempt ${attempt})`);
        return audioBase64;
      }

      return null;
      
    } catch (error) {
        const isRateLimit = error.response?.status === 429;
        const isLastAttempt = attempt === maxRetries;
        
        if (isRateLimit && !isLastAttempt) {
          const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
          console.warn(`⏳ Rate limited (429), retrying in ${backoffDelay}ms (attempt ${attempt}/${maxRetries})`);
          await this.delay(backoffDelay);
          continue;
        }
        
        // If it's not a rate limit or it's the last attempt, throw the error
        console.error(`❌ ElevenLabs API error (attempt ${attempt}/${maxRetries}):`, error.response?.status, error.response?.statusText);
        
        // Decode error response to understand the issue
        if (error.response && error.response.data) {
          try {
            const errorText = Buffer.from(error.response.data).toString('utf-8');
            console.error(`❌ ElevenLabs error details:`, errorText);
          } catch (decodeError) {
            console.error(`❌ Could not decode error response:`, error.response.data);
          }
        }
        
      throw error;
    }
    }
  }

  /**
   * Clean old cache entries (older than 10 seconds)
   */
  cleanCache() {
    const now = Date.now();
    const maxAge = 10000; // 10 seconds
    
    for (const [key, entry] of this.requestCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.requestCache.delete(key);
      }
    }
  }

  /**
   * Apply emotional enhancement for turbo v2.5 model (using voice settings instead of tags)
   */
  applyEmotionalTags(text, emotionalProfile) {
    // For turbo v2.5, we don't use audio tags but rely on voice settings
    // The emotional expression is handled through stability, style, and similarity_boost parameters
    return text;
  }

  /**
   * Simple delay utility
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get optimized voice settings for different languages and emotions
   */
  getOptimizedSettings(language) {
    // Base settings optimized for natural conversation
    const baseSettings = {
      stability: 0.75,
      similarity_boost: 0.8,
      style: 0.3,
      use_speaker_boost: true
    };

    // Language-specific optimizations
    switch (language) {
      case 'tr': // Turkish
        return {
          ...baseSettings,
          stability: 0.8, // More stability for Turkish pronunciation
          similarity_boost: 0.85
        };
      case 'en': // English
        return {
          ...baseSettings,
          stability: 0.7, // Slightly more dynamic for English
          style: 0.4
        };
      default:
        return baseSettings;
    }
  }

  /**
   * Get the best model for each language with latest ElevenLabs models
   */
  getModelForLanguage(language) {
    switch (language) {
      case 'tr':
        return 'eleven_turbo_v2_5'; // Latest real-time model with emotional support
      case 'en':
        return 'eleven_turbo_v2_5'; // Latest real-time model with emotional support
      default:
        return 'eleven_turbo_v2_5'; // Default to turbo v2.5 for real-time synthesis
    }
  }

  /**
   * Stop synthesis stream for a user
   */
  stopStreamingSynthesis(userId) {
    const streamInfo = this.activeStreams.get(userId);
    
    if (streamInfo) {
      console.log(`⏹️ Stopping synthesis stream for ${userId}`);
      streamInfo.isActive = false;
      this.activeStreams.delete(userId);
    }
  }

  /**
   * Clean up inactive streams
   */
  cleanupInactiveStreams() {
    const now = Date.now();
    const timeout = 300000; // 5 minutes (increased from 30 seconds)
    
    for (const [userId, streamInfo] of this.activeStreams.entries()) {
      if (now - streamInfo.lastActivity > timeout) {
        console.log(`🧹 Cleaning up inactive synthesis stream for ${userId} (inactive for ${Math.round((now - streamInfo.lastActivity)/1000)}s)`);
        this.stopStreamingSynthesis(userId);
      }
    }
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount() {
    return this.activeStreams.size;
  }

  /**
   * Shutdown all streams
   */
  shutdown() {
    console.log('🔌 Shutting down all synthesis streams...');
    
    for (const userId of this.activeStreams.keys()) {
      this.stopStreamingSynthesis(userId);
    }
  }
}

module.exports = StreamingSynthesisService;
