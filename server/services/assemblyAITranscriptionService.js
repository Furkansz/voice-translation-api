const WebSocket = require('ws');
const axios = require('axios');

class AssemblyAITranscriptionService {
  constructor(config) {
    this.config = config;
    this.apiKey = config.ASSEMBLYAI_API_KEY;
    this.activeConnections = new Map();
  }

  /**
   * Start AssemblyAI real-time transcription for a user
   */
  async startAssemblyAITranscription(userId, language, onPartialResult, onFinalResult, onError) {
    try {
      console.log(`🚀 Starting AssemblyAI real-time transcription for ${userId} (${language})`);
      
      // Step 1: Get temporary authentication token for real-time
      const tokenResponse = await axios.post('https://api.assemblyai.com/v2/realtime/token', 
        { expires_in: 3600 }, // 1 hour session
        {
          headers: {
            'authorization': this.apiKey,
            'content-type': 'application/json'
          }
        }
      );

      if (!tokenResponse.data.token) {
        throw new Error('Failed to get AssemblyAI real-time token');
      }

      const token = tokenResponse.data.token;
      console.log(`✅ Got AssemblyAI real-time token for ${userId}`);

      // Step 2: Connect to AssemblyAI real-time WebSocket
      const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`;
      const ws = new WebSocket(wsUrl);

      // Store connection info
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
        keepAliveInterval: null,
        token
      };

      this.activeConnections.set(userId, connectionInfo);

      // WebSocket event handlers
      ws.on('open', () => {
        console.log(`✅ AssemblyAI real-time connected for ${userId}`);
        connectionInfo.isConnected = true;
        
        // Send configuration for language-specific optimization
        const config = {
          sample_rate: 16000,
          word_boost: language === 'tr' ? ['doktor', 'hasta', 'ağrı', 'ilaç', 'tedavi'] : ['doctor', 'patient', 'pain', 'medicine', 'treatment'],
          boost_param: 'high' // Boost medical terms
        };
        
        if (language === 'tr') {
          // Turkish-specific optimizations
          config.language_code = 'tr';
          config.punctuate = true;
          config.format_text = true;
        } else {
          // English optimizations
          config.punctuate = true;
          config.format_text = true;
        }
        
        ws.send(JSON.stringify(config));
        console.log(`🎯 Sent AssemblyAI config for ${userId}:`, config);
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.message_type === 'PartialTranscript') {
            const transcript = response.text;
            const confidence = response.confidence || 0.8;
            
            if (transcript && transcript.trim()) {
              console.log(`📝 PARTIAL AssemblyAI (${userId}): "${transcript}" (${confidence.toFixed(2)})`);
              
              connectionInfo.lastActivity = Date.now();
              
              onPartialResult({
                text: transcript,
                confidence: confidence,
                language: language,
                userId: userId,
                timestamp: Date.now(),
                isPartial: true
              });
            }
          } else if (response.message_type === 'FinalTranscript') {
            const transcript = response.text;
            const confidence = response.confidence || 0.9;
            
            if (transcript && transcript.trim()) {
              console.log(`📝 FINAL AssemblyAI (${userId}): "${transcript}" (${confidence.toFixed(2)})`);
              
              connectionInfo.currentTranscript = transcript;
              connectionInfo.lastActivity = Date.now();
              
              onFinalResult({
                text: transcript,
                confidence: confidence,
                language: language,
                userId: userId,
                timestamp: Date.now()
              });
            }
          } else if (response.message_type === 'SessionBegins') {
            console.log(`🎬 AssemblyAI session started for ${userId}:`, response);
          } else if (response.message_type === 'SessionTerminated') {
            console.log(`🏁 AssemblyAI session terminated for ${userId}:`, response);
          }
          
        } catch (parseError) {
          console.error(`❌ Failed to parse AssemblyAI response for ${userId}:`, parseError);
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ AssemblyAI real-time error for ${userId}:`, error);
        connectionInfo.isConnected = false;
        onError(error);
      });

      ws.on('close', (code, reason) => {
        console.log(`🔌 AssemblyAI connection closed for ${userId}: ${code} ${reason}`);
        connectionInfo.isConnected = false;
        
        // Clean up keep-alive interval
        if (connectionInfo.keepAliveInterval) {
          clearInterval(connectionInfo.keepAliveInterval);
          connectionInfo.keepAliveInterval = null;
        }
      });

      return true;
      
    } catch (error) {
      console.error(`❌ Failed to start AssemblyAI transcription for ${userId}:`, error);
      onError(error);
      return false;
    }
  }

  /**
   * Send real-time audio data to AssemblyAI
   */
  sendAudioData(userId, audioData) {
    const connection = this.activeConnections.get(userId);
    
    if (!connection || !connection.isConnected) {
      console.warn(`⚠️ No active AssemblyAI connection for ${userId}`);
      return false;
    }

    try {
      if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
        // Convert base64 to binary data for AssemblyAI
        const audioBuffer = Buffer.from(audioData, 'base64');
        
        // Send binary audio data to AssemblyAI
        connection.ws.send(audioBuffer);
        connection.lastActivity = Date.now();
        
        console.log(`📡 Sent ${audioBuffer.length} bytes to AssemblyAI for ${userId}`);
        return true;
      } else {
        console.warn(`⚠️ AssemblyAI WebSocket not ready for ${userId}, state: ${connection.ws?.readyState}`);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ Failed to send audio data to AssemblyAI for ${userId}:`, error);
      connection.onError(error);
      return false;
    }
  }

  /**
   * Stop AssemblyAI transcription for a user
   */
  stopAssemblyAITranscription(userId) {
    const connection = this.activeConnections.get(userId);
    
    if (connection) {
      console.log(`⏹️ Stopping AssemblyAI transcription for ${userId}`);
      
      // Clean up keep-alive interval
      if (connection.keepAliveInterval) {
        clearInterval(connection.keepAliveInterval);
        connection.keepAliveInterval = null;
      }
      
      if (connection.ws) {
        // Send terminate message to AssemblyAI
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(JSON.stringify({ terminate_session: true }));
        }
        connection.ws.close();
      }
      
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
        console.log(`🧹 Cleaning up inactive AssemblyAI connection for ${userId}`);
        this.stopAssemblyAITranscription(userId);
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
    console.log('🔌 Shutting down all AssemblyAI transcription connections...');
    
    for (const userId of this.activeConnections.keys()) {
      this.stopAssemblyAITranscription(userId);
    }
  }
}

module.exports = AssemblyAITranscriptionService;
