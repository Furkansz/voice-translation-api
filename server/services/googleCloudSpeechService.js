const speech = require('@google-cloud/speech');
const WebSocket = require('ws');
const fs = require('fs');
const { Transform } = require('stream');

class GoogleCloudSpeechService {
  constructor(config) {
    this.config = config;
    this.activeConnections = new Map();
    this.partialResults = new Map();
    
    // Initialize Google Cloud Speech client with service account
    try {
      const keyFilename = config.GOOGLE_CLOUD_KEY_FILE || './server/google-cloud-credentials.json';
      this.speechClient = new speech.SpeechClient({
        keyFilename: keyFilename,
        projectId: config.GOOGLE_CLOUD_PROJECT_ID
      });
      
      console.log('🌟 Google Cloud Speech-to-Text service initialized successfully');
      console.log(`📁 Using credentials file: ${keyFilename}`);
      console.log(`🏢 Project ID: ${config.GOOGLE_CLOUD_PROJECT_ID}`);
    } catch (error) {
      console.error('❌ Failed to initialize Google Cloud Speech client:', error);
      this.speechClient = null;
    }
  }

  /**
   * Start streaming transcription using Google Cloud Speech-to-Text
   */
  async startStreamingTranscription(userId, language, onPartialResult, onFinalResult, onError) {
    try {
      // Check if Google Cloud client is available
      if (!this.speechClient) {
        console.error(`❌ Google Cloud Speech client not initialized for ${userId}`);
        onError && onError(new Error('Google Cloud Speech client not available'));
        return false;
      }
      
      console.log(`🎤 Starting Google Cloud streaming transcription for ${userId} (${language})`);
      
      const request = {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: this.getLanguageCode(language),
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          model: 'latest_long', // Optimized for longer audio
          useEnhanced: true,
          enableSpeakerDiarization: false,
          maxAlternatives: 1,
          profanityFilter: false,
        },
        interimResults: true,
        enableVoiceActivityEvents: true,
      };

      // Create the recognize stream
      const recognizeStream = this.speechClient
        .streamingRecognize(request)
        .on('error', (error) => {
          console.error(`❌ Google Cloud Speech error for ${userId}:`, error);
          this.handleStreamError(userId, error, onError);
        })
        .on('data', (data) => {
          this.handleStreamData(userId, data, language, onPartialResult, onFinalResult);
        })
        .on('end', () => {
          console.log(`🔚 Google Cloud streaming ended for ${userId}`);
          this.cleanup(userId);
        });

      // Store connection info
      this.activeConnections.set(userId, {
        stream: recognizeStream,
        language: language,
        isConnected: true,
        startTime: Date.now(),
        lastActivity: Date.now(),
        onPartialResult,
        onFinalResult,
        onError,
        audioBuffer: [],
        totalAudioSent: 0
      });

      console.log(`✅ Google Cloud streaming connected for ${userId}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to start Google Cloud transcription for ${userId}:`, error);
      onError && onError(error);
      return false;
    }
  }

  /**
   * Send audio data to Google Cloud Speech-to-Text
   */
  sendAudioData(userId, audioData) {
    const connection = this.activeConnections.get(userId);
    
    if (!connection || !connection.isConnected || !connection.stream) {
      console.warn(`⚠️ No active Google Cloud connection for ${userId}`);
      return false;
    }

    try {
      // Convert base64 audio to buffer
      let audioBuffer;
      if (typeof audioData === 'string') {
        audioBuffer = Buffer.from(audioData, 'base64');
      } else {
        audioBuffer = audioData;
      }
      
      // Convert audio to LINEAR16 format if needed
      // For now, send the raw buffer - Google Cloud will handle basic conversions
      connection.stream.write(audioBuffer);
      connection.lastActivity = Date.now();
      connection.totalAudioSent += audioBuffer.length;
      
      console.log(`📡 Sent ${audioBuffer.length} bytes to Google Cloud for ${userId}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to send audio data to Google Cloud for ${userId}:`, error);
      connection.onError && connection.onError(error);
      return false;
    }
  }

  /**
   * Handle streaming data from Google Cloud Speech-to-Text
   */
  handleStreamData(userId, data, language, onPartialResult, onFinalResult) {
    if (!data.results || data.results.length === 0) {
      return;
    }

    const result = data.results[0];
    const alternative = result.alternatives[0];
    
    if (!alternative || !alternative.transcript) {
      return;
    }

    const transcript = alternative.transcript.trim();
    const confidence = alternative.confidence || 0.8;
    const isFinal = result.isFinal;

    console.log(`🎯 Google Cloud ${isFinal ? 'final' : 'partial'} result for ${userId}: "${transcript}" (confidence: ${confidence})`);

    if (isFinal) {
      // Final result
      if (onFinalResult) {
        onFinalResult({
          text: transcript,          // ← FIXED: Use "text" instead of "transcript"
          confidence,
          language,
          userId,                    // ← ADDED: Include userId
          isFinal: true,
          provider: 'google-cloud',
          timestamp: Date.now()
        });
      }
    } else {
      // Partial result
      if (onPartialResult) {
        onPartialResult({
          text: transcript,          // ← FIXED: Use "text" instead of "transcript"
          confidence,
          language,
          userId,                    // ← ADDED: Include userId
          isFinal: false,
          isPartial: true,           // ← ADDED: For consistency
          provider: 'google-cloud',
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Handle stream errors
   */
  handleStreamError(userId, error, onError) {
    console.error(`❌ Google Cloud streaming error for ${userId}:`, error.message);
    
    // Check if this is a timeout error that can be recovered
    if (error.code === 11 || error.message.includes('Audio Timeout Error')) {
      console.log(`🔄 Attempting to recreate stream for ${userId} after timeout`);
      this.recreateStreamAfterTimeout(userId);
      return;
    }
    
    // Clean up the connection
    this.cleanup(userId);
    
    // Notify error handler
    if (onError) {
      onError(error);
    }
  }

  /**
   * Recreate stream after timeout error
   */
  async recreateStreamAfterTimeout(userId) {
    const connection = this.activeConnections.get(userId);
    if (!connection) {
      console.warn(`⚠️ No connection found for ${userId} during stream recreation`);
      return;
    }

    // Store connection details before cleanup
    const { language, onPartialResult, onFinalResult, onError } = connection;
    
    // Clean up the old connection
    this.cleanup(userId);
    
    // Wait a short moment before recreating
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Recreate the stream
    console.log(`🔄 Recreating Google Cloud stream for ${userId}`);
    const success = await this.startStreamingTranscription(
      userId, 
      language, 
      onPartialResult, 
      onFinalResult, 
      onError
    );
    
    if (success) {
      console.log(`✅ Successfully recreated stream for ${userId}`);
    } else {
      console.error(`❌ Failed to recreate stream for ${userId}`);
      onError && onError(new Error('Failed to recreate stream after timeout'));
    }
  }

  /**
   * Stop transcription for a user
   */
  stopTranscription(userId) {
    const connection = this.activeConnections.get(userId);
    
    if (connection && connection.stream) {
      try {
        console.log(`⏹️ Stopping Google Cloud transcription for ${userId}`);
        connection.stream.end();
        connection.isConnected = false;
      } catch (error) {
        console.error(`❌ Error stopping Google Cloud transcription for ${userId}:`, error);
      }
    }
    
    this.cleanup(userId);
  }

  /**
   * Cleanup connection resources
   */
  cleanup(userId) {
    const connection = this.activeConnections.get(userId);
    
    if (connection) {
      const duration = Date.now() - connection.startTime;
      console.log(`🧹 Cleaning up Google Cloud connection for ${userId} (duration: ${duration}ms, audio sent: ${connection.totalAudioSent} bytes)`);
      
      connection.isConnected = false;
      this.activeConnections.delete(userId);
      this.partialResults.delete(userId);
    }
  }

  /**
   * Get Google Cloud language code from our language format
   */
  getLanguageCode(language) {
    const languageMap = {
      'en': 'en-US',
      'tr': 'tr-TR',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-BR',
      'ru': 'ru-RU',
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'ar': 'ar-SA',
      'hi': 'hi-IN'
    };
    
    return languageMap[language] || 'en-US';
  }

  /**
   * Get active connection count
   */
  getActiveConnectionCount() {
    return this.activeConnections.size;
  }

  /**
   * Check if user has active connection
   */
  hasActiveConnection(userId) {
    const connection = this.activeConnections.get(userId);
    return connection && connection.isConnected;
  }

  /**
   * Get connection stats
   */
  getConnectionStats(userId) {
    const connection = this.activeConnections.get(userId);
    
    if (!connection) {
      return null;
    }
    
    return {
      isConnected: connection.isConnected,
      language: connection.language,
      duration: Date.now() - connection.startTime,
      totalAudioSent: connection.totalAudioSent,
      lastActivity: connection.lastActivity
    };
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    return {
      name: 'Google Cloud Speech-to-Text',
      activeConnections: this.activeConnections.size,
      isHealthy: true,
      supportedLanguages: ['en', 'tr', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'],
      features: ['streaming', 'real-time', 'punctuation', 'confidence-scores', 'multiple-languages']
    };
  }
}

module.exports = GoogleCloudSpeechService;
