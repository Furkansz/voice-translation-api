const WebSocket = require('ws');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const WhisperTranscriptionService = require('./whisperTranscriptionService');
const AssemblyAITranscriptionService = require('./assemblyAITranscriptionService');
const GoogleCloudSpeechService = require('./googleCloudSpeechService');

class StreamingTranscriptionService {
  constructor(config) {
    this.config = config;
    this.activeConnections = new Map();
    this.partialResults = new Map();
    
    // Initialize all transcription services
    this.googleCloudService = new GoogleCloudSpeechService(config);
    this.whisperService = new WhisperTranscriptionService(config);
    this.assemblyAIService = new AssemblyAITranscriptionService(config);
    
    console.log('🔄 Streaming Transcription Service initialized with all providers');
  }

  /**
   * Start real-time streaming transcription for a user
   */
  async startStreamingTranscription(userId, language, onPartialResult, onFinalResult, onError) {
    try {
      console.log(`🎙️ Starting streaming transcription for ${userId} (${language})`);
      
      // Use Google Cloud Speech-to-Text as primary service (excellent quality for Turkish and other languages)
      if (this.config.GOOGLE_CLOUD_PROJECT_ID) {
        console.log(`🌟 Using Google Cloud Speech-to-Text for ${language} transcription for ${userId}`);
        const googleSuccess = await this.googleCloudService.startStreamingTranscription(userId, language, onPartialResult, onFinalResult, onError);
        if (googleSuccess) {
          return true;
        }
        console.log(`⚠️ Google Cloud failed for ${userId}, falling back to other services`);
      }
      
      // Use AssemblyAI as secondary fallback
      if (this.config.ASSEMBLYAI_API_KEY) {
        console.log(`🚀 Using AssemblyAI for ${language} transcription for ${userId}`);
        const assemblySuccess = await this.assemblyAIService.startAssemblyAITranscription(userId, language, onPartialResult, onFinalResult, onError);
        if (assemblySuccess) {
          return true;
        }
        console.log(`⚠️ AssemblyAI failed for ${userId}, falling back to Deepgram`);
      }
      
      // For Turkish, try Whisper as third fallback
      if (language === 'tr' && this.config.OPENAI_API_KEY) {
        console.log(`🤖 Using Whisper for Turkish transcription for ${userId}`);
        return await this.whisperService.startWhisperTranscription(userId, language, onPartialResult, onFinalResult, onError);
      }
      
      // Use Deepgram streaming WebSocket as final fallback
      // Enhanced language mapping with Turkish-specific optimizations
      const getDeepgramConfig = (lang) => {
        if (lang === 'tr') {
          return {
            language: 'tr',
            model: 'general', // Better Turkish support than nova-2
            smart_format: 'true',
            punctuate: 'true',
            interim_results: 'true',
            endpointing: '500', // Longer pause for Turkish
            utterance_end_ms: '1500', // More time for Turkish sentence structure
            vad_events: 'true',
            encoding: 'linear16',
            sample_rate: '16000',
            channels: '1',
            tier: 'enhanced' // Better accuracy for Turkish
          };
        } else {
          return {
            language: 'en-US',
            model: 'nova-2',
            smart_format: 'true',
            punctuate: 'true',
            interim_results: 'true',
            endpointing: '300',
            utterance_end_ms: '1000',
            vad_events: 'true',
            encoding: 'linear16',
            sample_rate: '16000',
            channels: '1'
          };
        }
      };
      
      const config = getDeepgramConfig(language);
      const deepgramUrl = `wss://api.deepgram.com/v1/listen?` + new URLSearchParams(config);

      const ws = new WebSocket(deepgramUrl, {
        headers: {
          'Authorization': `Token ${this.config.DEEPGRAM_API_KEY}`
        }
      });

      // Store connection
      const connectionInfo = {
        ws,
        userId,
        language,
        onPartialResult,
        onFinalResult,
        onError,
        isConnected: false,
        currentTranscript: '',
        lastActivity: Date.now(),
        keepAliveInterval: null
      };

      this.activeConnections.set(userId, connectionInfo);

      ws.on('open', () => {
        console.log(`✅ Deepgram streaming connected for ${userId}`);
        connectionInfo.isConnected = true;
        
        // Start keep-alive mechanism to prevent timeouts
        connectionInfo.keepAliveInterval = setInterval(() => {
          if (ws.readyState === 1) { // WebSocket.OPEN
            // Send keep-alive message (empty audio data to keep connection alive)
            const keepAliveData = JSON.stringify({ type: 'KeepAlive' });
            ws.send(keepAliveData);
            console.log(`💗 Keep-alive sent for ${userId}`);
          }
        }, 15000); // Send every 15 seconds
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.type === 'Results' && response.channel?.alternatives?.length > 0) {
            const transcript = response.channel.alternatives[0].transcript;
            const confidence = response.channel.alternatives[0].confidence;
            const isFinal = response.is_final;
            
            if (transcript && transcript.trim()) {
              console.log(`📝 ${isFinal ? 'FINAL' : 'PARTIAL'} (${userId}): "${transcript}" (${confidence?.toFixed(2) || 'N/A'})`);
              
              connectionInfo.lastActivity = Date.now();
              
              if (isFinal) {
                // Final result - trigger translation
                connectionInfo.currentTranscript = transcript;
                onFinalResult({
                  text: transcript,
                  confidence: confidence || 0,
                  language: language,
                  userId: userId,
                  timestamp: Date.now()
                });
              } else {
                // Partial result - show live transcription
                onPartialResult({
                  text: transcript,
                  confidence: confidence || 0,
                  language: language,
                  userId: userId,
                  timestamp: Date.now(),
                  isPartial: true
                });
              }
            }
          }
          
          if (response.type === 'Metadata') {
            console.log(`📊 Deepgram metadata for ${userId}:`, response);
          }
          
        } catch (parseError) {
          console.error(`❌ Failed to parse Deepgram response for ${userId}:`, parseError);
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ Deepgram streaming error for ${userId}:`, error);
        console.log(`🔄 Immediately falling back to REST API for ${userId}`);
        
        // Clean up failed WebSocket connection
        this.stopStreamingTranscription(userId);
        
        // Start REST API fallback mode immediately
        this.startRestApiFallback(userId, language, onPartialResult, onFinalResult, onError);
      });

      ws.on('close', (code, reason) => {
        console.log(`🔌 Deepgram connection closed for ${userId}: ${code} ${reason}`);
        connectionInfo.isConnected = false;
        
        // Clean up keep-alive interval
        if (connectionInfo.keepAliveInterval) {
          clearInterval(connectionInfo.keepAliveInterval);
          connectionInfo.keepAliveInterval = null;
        }
        
        // If connection closed due to timeout or other issues, start REST API fallback
        if (code === 1011 || code === 1006) {
          console.log(`🔄 Starting REST API fallback for ${userId} due to WebSocket closure (${code})`);
          this.startRestApiFallback(userId, language, onPartialResult, onFinalResult, onError);
        }
      });

      return true;
      
    } catch (error) {
      console.error(`❌ Failed to start streaming transcription for ${userId}:`, error);
      onError(error);
      return false;
    }
  }

  /**
   * Send real-time audio data to the streaming transcription
   */
  sendAudioData(userId, audioData) {
    const connection = this.activeConnections.get(userId);
    
    if (!connection || !connection.isConnected) {
      // Try Google Cloud service first
      if (this.googleCloudService.hasActiveConnection(userId)) {
        return this.googleCloudService.sendAudioData(userId, audioData);
      }
      // Try AssemblyAI service second
      if (this.assemblyAIService.getActiveConnectionCount() > 0) {
        return this.assemblyAIService.sendAudioData(userId, audioData);
      }
      // Try Whisper service as fallback
      if (this.whisperService.getActiveConnectionCount() > 0) {
        return this.whisperService.sendAudioData(userId, audioData);
      }
      console.warn(`⚠️ No active transcription connection for ${userId}`);
      return false;
    }

    try {
      // Handle REST API fallback mode
      if (connection.mode === 'rest-api') {
        // Buffer audio data for REST API processing
        connection.audioBuffer.push(audioData);
        
        // Process when we have enough audio data (more aggressive for Turkish)
        const chunksNeeded = connection.language === 'tr' ? 15 : 20; // 1.5s for Turkish, 2s for others
        if (connection.audioBuffer.length >= chunksNeeded) {
          const audioToProcess = connection.audioBuffer.join('');
          connection.audioBuffer = [];
          
          // Process audio using REST API (don't await to keep it non-blocking)
          this.processRestApiAudio(userId, audioToProcess);
        }
        
        connection.lastActivity = Date.now();
        return true;
      }
      
      // Handle WebSocket streaming mode
      if (connection.ws) {
        const audioBuffer = Buffer.from(audioData, 'base64');
        
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(audioBuffer);
          connection.lastActivity = Date.now();
          console.log(`📡 Sent ${audioBuffer.length} bytes to Deepgram for ${userId}`);
          return true;
        } else {
          console.warn(`⚠️ WebSocket not ready for ${userId}, state: ${connection.ws.readyState}`);
          return false;
        }
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Failed to send audio data for ${userId}:`, error);
      connection.onError(error);
      return false;
    }
  }

  /**
   * Stop streaming transcription for a user
   */
  stopStreamingTranscription(userId) {
    const connection = this.activeConnections.get(userId);
    
    if (connection) {
      console.log(`⏹️ Stopping streaming transcription for ${userId}`);
      
      // Clean up keep-alive interval
      if (connection.keepAliveInterval) {
        clearInterval(connection.keepAliveInterval);
        connection.keepAliveInterval = null;
      }
      
      if (connection.ws) {
        // Send close frame to Deepgram
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(JSON.stringify({ type: 'CloseStream' }));
        }
        connection.ws.close();
      }
      
      this.activeConnections.delete(userId);
    }
    
    // Also stop other services if active
    this.assemblyAIService.stopAssemblyAITranscription(userId);
    this.whisperService.stopWhisperTranscription(userId);
  }

  /**
   * Check for inactive connections and clean up
   */
  cleanupInactiveConnections() {
    const now = Date.now();
    const timeout = 30000; // 30 seconds timeout
    
    for (const [userId, connection] of this.activeConnections.entries()) {
      if (now - connection.lastActivity > timeout) {
        console.log(`🧹 Cleaning up inactive connection for ${userId}`);
        this.stopStreamingTranscription(userId);
      }
    }
    
    // Also cleanup other service connections
    this.assemblyAIService.cleanupInactiveConnections();
    this.whisperService.cleanupInactiveConnections();
  }

  /**
   * Get active connection count
   */
  getActiveConnectionCount() {
    return this.activeConnections.size + this.assemblyAIService.getActiveConnectionCount() + this.whisperService.getActiveConnectionCount();
  }

  /**
   * Start REST API fallback when WebSocket streaming fails
   */
  async startRestApiFallback(userId, language, onPartialResult, onFinalResult, onError) {
    try {
      console.log(`🔄 Starting REST API fallback for ${userId} (${language})`);
      
      // Create fallback connection info
      const connectionInfo = {
        userId,
        language,
        onPartialResult,
        onFinalResult,
        onError,
        isConnected: true,
        currentTranscript: '',
        lastActivity: Date.now(),
        audioBuffer: [],
        processingTimeout: null,
        mode: 'rest-api'
      };

      this.activeConnections.set(userId, connectionInfo);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to start REST API fallback for ${userId}:`, error);
      onError(error);
      return false;
    }
  }

  /**
   * Process audio using REST API (for fallback)
   */
  async processRestApiAudio(userId, audioBuffer) {
    const connection = this.activeConnections.get(userId);
    
    if (!connection || connection.mode !== 'rest-api') {
      return false;
    }

    try {
      // Convert audio buffer to WAV format for Deepgram REST API
      const audioData = Buffer.from(audioBuffer, 'base64');
      
      // Use optimized settings for each language in REST API
      const restApiParams = connection.language === 'tr' ? {
        language: 'tr',
        model: 'general', // Better Turkish support
        smart_format: 'true',
        punctuate: 'true',
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
        tier: 'enhanced'
      } : {
        language: 'en-US',
        model: 'nova-2',
        smart_format: 'true',
        punctuate: 'true',
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1'
      };
      
      const url = `${this.config.DEEPGRAM_URL}?` + new URLSearchParams(restApiParams);

      const response = await axios.post(url, audioData, {
        headers: {
          'Authorization': `Token ${this.config.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/wav',
        },
        timeout: 10000
      });

      if (response.status !== 200) {
        throw new Error(`Deepgram REST API error: ${response.status} - ${response.statusText}`);
      }

      const result = response.data;
      
      if (result.results?.channels?.[0]?.alternatives?.[0]) {
        const transcript = result.results.channels[0].alternatives[0].transcript;
        const confidence = result.results.channels[0].alternatives[0].confidence;
        
        if (transcript && transcript.trim()) {
          console.log(`📝 REST API transcription for ${userId}: "${transcript}"`);
          
          // Send as final result since REST API doesn't provide partial results
          connection.onFinalResult({
            text: transcript,
            confidence: confidence || 0.8,
            language: connection.language,
            userId: userId,
            timestamp: Date.now()
          });
          
          connection.lastActivity = Date.now();
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ REST API transcription error for ${userId}:`, error);
      connection.onError(error);
      return false;
    }
  }

  /**
   * Gracefully shutdown all connections
   */
  shutdown() {
    console.log('🔌 Shutting down all streaming transcription connections...');
    
    for (const userId of this.activeConnections.keys()) {
      this.stopStreamingTranscription(userId);
    }
    
    // Also shutdown other services
    this.googleCloudService.cleanup();
    this.assemblyAIService.shutdown();
    this.whisperService.shutdown();
  }

  /**
   * Stop transcription for a specific user
   */
  stopTranscription(userId) {
    console.log(`⏹️ Stopping streaming transcription for ${userId}`);
    
    const connection = this.activeConnections.get(userId);
    if (connection) {
      // Close WebSocket if it exists
      if (connection.ws) {
        connection.ws.close();
      }
      
      // Clear any pending timeouts
      if (connection.restApiTimeout) {
        clearTimeout(connection.restApiTimeout);
      }
      
      connection.isConnected = false;
      this.activeConnections.delete(userId);
    }
    
    // Clean up partial results
    this.partialResults.delete(userId);
    
    // Stop all services
    this.googleCloudService.stopTranscription(userId);
    if (this.assemblyAIService.stopTranscription) {
      this.assemblyAIService.stopTranscription(userId);
    }
    if (this.whisperService.stopTranscription) {
      this.whisperService.stopTranscription(userId);
    }
  }

  /**
   * Stop streaming transcription for a user (alias for compatibility)
   */
  stopStreamingTranscription(userId) {
    return this.stopTranscription(userId);
  }
}

module.exports = StreamingTranscriptionService;
