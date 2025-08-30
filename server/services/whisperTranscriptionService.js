const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class WhisperTranscriptionService {
  constructor(config) {
    this.config = config;
    this.openaiApiKey = process.env.OPENAI_API_KEY || config.OPENAI_API_KEY;
    this.activeConnections = new Map();
  }

  /**
   * Start Whisper-based transcription for a user (chunked processing)
   */
  async startWhisperTranscription(userId, language, onPartialResult, onFinalResult, onError) {
    try {
      console.log(`🤖 Starting Whisper transcription for ${userId} (${language})`);
      
      const connectionInfo = {
        userId,
        language,
        onPartialResult,
        onFinalResult,
        onError,
        isConnected: true,
        audioBuffer: [],
        lastActivity: Date.now(),
        processingTimeout: null,
        mode: 'whisper'
      };

      this.activeConnections.set(userId, connectionInfo);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to start Whisper transcription for ${userId}:`, error);
      onError(error);
      return false;
    }
  }

  /**
   * Send audio data to Whisper processing queue
   */
  sendAudioData(userId, audioData) {
    const connection = this.activeConnections.get(userId);
    
    if (!connection || !connection.isConnected) {
      console.warn(`⚠️ No active Whisper connection for ${userId}`);
      return false;
    }

    try {
      // Buffer audio data for Whisper processing
      connection.audioBuffer.push(audioData);
      
      // Process when we have enough audio data (2-3 seconds for good Whisper results)
      const chunksNeeded = connection.language === 'tr' ? 25 : 30; // 2.5s for Turkish, 3s for others
      if (connection.audioBuffer.length >= chunksNeeded) {
        const audioToProcess = connection.audioBuffer.join('');
        connection.audioBuffer = [];
        
        // Process audio using Whisper API (don't await to keep it non-blocking)
        this.processWhisperAudio(userId, audioToProcess);
      }
      
      connection.lastActivity = Date.now();
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to send audio data to Whisper for ${userId}:`, error);
      connection.onError(error);
      return false;
    }
  }

  /**
   * Process audio using OpenAI Whisper API
   */
  async processWhisperAudio(userId, audioBuffer) {
    const connection = this.activeConnections.get(userId);
    
    if (!connection || connection.mode !== 'whisper') {
      return false;
    }

    try {
      // Convert audio buffer to a temporary file for Whisper
      const audioData = Buffer.from(audioBuffer, 'base64');
      const tempFilePath = path.join(__dirname, '../uploads', `temp_${userId}_${Date.now()}.wav`);
      
      // Write temporary audio file
      fs.writeFileSync(tempFilePath, audioData);
      
      // Create form data for Whisper API
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFilePath));
      formData.append('model', 'whisper-1');
      
      // Map language for Whisper
      const whisperLanguage = connection.language === 'tr' ? 'tr' : 'en';
      formData.append('language', whisperLanguage);
      formData.append('response_format', 'json');
      formData.append('temperature', '0'); // More deterministic results

      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          ...formData.getHeaders(),
        },
        timeout: 10000
      });

      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to cleanup temp file ${tempFilePath}:`, cleanupError);
      }

      if (response.status !== 200) {
        throw new Error(`Whisper API error: ${response.status} - ${response.statusText}`);
      }

      const result = response.data;
      
      if (result.text && result.text.trim()) {
        console.log(`🤖 Whisper transcription for ${userId}: "${result.text}"`);
        
        // Send as final result since Whisper doesn't provide partial results
        connection.onFinalResult({
          text: result.text.trim(),
          confidence: 0.95, // Whisper is generally very accurate
          language: connection.language,
          userId: userId,
          timestamp: Date.now()
        });
        
        connection.lastActivity = Date.now();
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Whisper transcription error for ${userId}:`, error);
      connection.onError(error);
      return false;
    }
  }

  /**
   * Stop Whisper transcription for a user
   */
  stopWhisperTranscription(userId) {
    const connection = this.activeConnections.get(userId);
    
    if (connection) {
      console.log(`⏹️ Stopping Whisper transcription for ${userId}`);
      connection.isConnected = false;
      this.activeConnections.delete(userId);
    }
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    const timeout = 30000; // 30 seconds timeout
    
    for (const [userId, connection] of this.activeConnections.entries()) {
      if (now - connection.lastActivity > timeout) {
        console.log(`🧹 Cleaning up inactive Whisper connection for ${userId}`);
        this.stopWhisperTranscription(userId);
      }
    }
  }

  /**
   * Get active connection count
   */
  getActiveConnectionCount() {
    return this.activeConnections.size;
  }

  /**
   * Shutdown all connections
   */
  shutdown() {
    console.log('🔌 Shutting down all Whisper transcription connections...');
    
    for (const userId of this.activeConnections.keys()) {
      this.stopWhisperTranscription(userId);
    }
  }
}

module.exports = WhisperTranscriptionService;
