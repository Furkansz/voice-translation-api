/**
 * Real-time Translation API Routes
 * Handles WebSocket connections and real-time voice translation
 */

const express = require('express');
const WebSocket = require('ws');
const router = express.Router();

// Import services
const StreamingTranslationPipeline = require('../../server/services/streamingTranslationPipeline');
const ApiSessionManager = require('../services/apiSessionManager');
const WebhookService = require('../services/webhookService');

const translationPipeline = new StreamingTranslationPipeline();
const apiSessionManager = new ApiSessionManager();
const webhookService = new WebhookService();

/**
 * WebSocket connection handler for real-time translation
 * Connect via: ws://localhost:3001/api/translate?sessionId=xxx&participantId=xxx&apiKey=xxx
 */
function handleWebSocketConnection(ws, req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');
  const participantId = url.searchParams.get('participantId');
  const apiKey = url.searchParams.get('apiKey');

  console.log(`🔌 WebSocket connection attempt: session=${sessionId}, participant=${participantId}`);

  // Validate parameters
  if (!sessionId || !participantId || !apiKey) {
    ws.close(1008, 'Missing required parameters: sessionId, participantId, apiKey');
    return;
  }

  // Authenticate and validate session
  apiSessionManager.validateSessionAccess(sessionId, participantId, apiKey)
    .then(async (session) => {
      if (!session) {
        ws.close(1008, 'Invalid session or access denied');
        return;
      }

      console.log(`✅ WebSocket authenticated: ${participantId} in session ${sessionId}`);

      // Find participant info
      const participant = session.participants.find(p => p.id === participantId);
      if (!participant) {
        ws.close(1008, 'Participant not found in session');
        return;
      }

      // Setup translation pipeline for this participant
      const translationSession = await translationPipeline.createSession({
        sessionId: sessionId,
        userId: participantId,
        language: participant.language,
        voiceId: participant.voiceId,
        partnerLanguage: session.participants.find(p => p.id !== participantId)?.language,
        partnerVoiceId: session.participants.find(p => p.id !== participantId)?.voiceId,
        options: session.options
      });

      // Mark participant as connected
      await apiSessionManager.updateParticipantStatus(sessionId, participantId, 'connected');

      // WebSocket event handlers
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data);
          
          switch (message.type) {
            case 'audio':
              // Handle incoming audio for translation
              await handleAudioMessage(ws, message, translationSession, session);
              break;
              
            case 'text':
              // Handle text-only translation
              await handleTextMessage(ws, message, translationSession, session);
              break;
              
            case 'status':
              // Handle status updates (mute, unmute, etc.)
              await handleStatusMessage(ws, message, translationSession, session);
              break;
              
            default:
              ws.send(JSON.stringify({
                type: 'error',
                error: 'Unknown message type',
                code: 'UNKNOWN_MESSAGE_TYPE'
              }));
          }
        } catch (error) {
          console.error(`❌ WebSocket message error for ${participantId}:`, error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Message processing failed',
            code: 'MESSAGE_PROCESSING_FAILED',
            details: error.message
          }));
        }
      });

      ws.on('close', async (code, reason) => {
        console.log(`🔌 WebSocket disconnected: ${participantId} (${code}: ${reason})`);
        
        // Mark participant as disconnected
        await apiSessionManager.updateParticipantStatus(sessionId, participantId, 'disconnected');
        
        // Cleanup translation session
        translationPipeline.cleanup(participantId);
        
        // Send webhook notification
        if (session.options.webhookUrl) {
          webhookService.sendWebhook(session.options.webhookUrl, {
            event: 'participant.disconnected',
            sessionId,
            participantId,
            timestamp: new Date().toISOString()
          });
        }
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${participantId}:`, error);
      });

      // Send connection success message
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId,
        participantId,
        message: 'Translation session ready',
        partner: {
          id: session.participants.find(p => p.id !== participantId)?.id,
          language: session.participants.find(p => p.id !== participantId)?.language,
          name: session.participants.find(p => p.id !== participantId)?.name
        }
      }));

      // Send webhook notification
      if (session.options.webhookUrl) {
        webhookService.sendWebhook(session.options.webhookUrl, {
          event: 'participant.connected',
          sessionId,
          participantId,
          timestamp: new Date().toISOString()
        });
      }

    })
    .catch(error => {
      console.error(`❌ WebSocket validation error:`, error);
      ws.close(1008, 'Session validation failed');
    });
}

/**
 * Handle incoming audio data for translation
 */
async function handleAudioMessage(ws, message, translationSession, session) {
  const { audioData, format = 'webm', sampleRate = 16000 } = message;

  if (!audioData) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Audio data is required',
      code: 'MISSING_AUDIO_DATA'
    }));
    return;
  }

  try {
    // Process audio through translation pipeline
    const result = await translationPipeline.processAudioChunk(
      translationSession.userId,
      audioData,
      {
        format,
        sampleRate,
        onTranscription: (transcription) => {
          // Send transcription back to client
          ws.send(JSON.stringify({
            type: 'transcription',
            text: transcription.text,
            language: transcription.language,
            confidence: transcription.confidence,
            isFinal: transcription.isFinal,
            timestamp: new Date().toISOString()
          }));

          // Send webhook notification
          if (session.options.webhookUrl && transcription.isFinal) {
            webhookService.sendWebhook(session.options.webhookUrl, {
              event: 'transcription.completed',
              sessionId: session.sessionId,
              participantId: translationSession.userId,
              transcription,
              timestamp: new Date().toISOString()
            });
          }
        },
        onTranslation: (translation) => {
          // Send translation back to client
          ws.send(JSON.stringify({
            type: 'translation',
            originalText: translation.originalText,
            translatedText: translation.translatedText,
            sourceLanguage: translation.sourceLanguage,
            targetLanguage: translation.targetLanguage,
            confidence: translation.confidence,
            timestamp: new Date().toISOString()
          }));

          // Send webhook notification
          if (session.options.webhookUrl) {
            webhookService.sendWebhook(session.options.webhookUrl, {
              event: 'translation.completed',
              sessionId: session.sessionId,
              participantId: translationSession.userId,
              translation,
              timestamp: new Date().toISOString()
            });
          }
        },
        onSynthesis: (audioData) => {
          // Send synthesized audio back to client
          ws.send(JSON.stringify({
            type: 'audio',
            audioData: audioData.toString('base64'),
            format: 'mp3',
            language: translationSession.partnerLanguage,
            voiceId: translationSession.partnerVoiceId,
            timestamp: new Date().toISOString()
          }));
        }
      }
    );

  } catch (error) {
    console.error(`❌ Audio processing error:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Audio processing failed',
      code: 'AUDIO_PROCESSING_FAILED',
      details: error.message
    }));
  }
}

/**
 * Handle text-only translation requests
 */
async function handleTextMessage(ws, message, translationSession, session) {
  const { text, sourceLanguage, targetLanguage } = message;

  if (!text) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Text is required',
      code: 'MISSING_TEXT'
    }));
    return;
  }

  try {
    const translation = await translationPipeline.translateText(
      text,
      sourceLanguage || translationSession.language,
      targetLanguage || translationSession.partnerLanguage
    );

    ws.send(JSON.stringify({
      type: 'translation',
      originalText: text,
      translatedText: translation.text,
      sourceLanguage: translation.sourceLanguage,
      targetLanguage: translation.targetLanguage,
      confidence: translation.confidence,
      timestamp: new Date().toISOString()
    }));

    // Send webhook notification
    if (session.options.webhookUrl) {
      webhookService.sendWebhook(session.options.webhookUrl, {
        event: 'text.translated',
        sessionId: session.sessionId,
        participantId: translationSession.userId,
        translation,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error(`❌ Text translation error:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Text translation failed',
      code: 'TEXT_TRANSLATION_FAILED',
      details: error.message
    }));
  }
}

/**
 * Handle status updates (mute, unmute, etc.)
 */
async function handleStatusMessage(ws, message, translationSession, session) {
  const { status, data } = message;

  try {
    switch (status) {
      case 'mute':
        await translationPipeline.muteParticipant(translationSession.userId);
        break;
      case 'unmute':
        await translationPipeline.unmuteParticipant(translationSession.userId);
        break;
      case 'pause':
        await translationPipeline.pauseTranslation(translationSession.userId);
        break;
      case 'resume':
        await translationPipeline.resumeTranslation(translationSession.userId);
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Unknown status type',
          code: 'UNKNOWN_STATUS_TYPE'
        }));
        return;
    }

    ws.send(JSON.stringify({
      type: 'status',
      status: 'updated',
      newStatus: status,
      timestamp: new Date().toISOString()
    }));

    // Send webhook notification
    if (session.options.webhookUrl) {
      webhookService.sendWebhook(session.options.webhookUrl, {
        event: 'participant.status_changed',
        sessionId: session.sessionId,
        participantId: translationSession.userId,
        status,
        data,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error(`❌ Status update error:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Status update failed',
      code: 'STATUS_UPDATE_FAILED',
      details: error.message
    }));
  }
}

/**
 * GET /api/translate/test
 * Test endpoint to verify translation API is working
 */
router.get('/test', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Translation API is ready',
    websocketUrl: 'ws://localhost:3001/api/translate',
    supportedLanguages: ['en', 'tr', 'es', 'fr', 'de', 'it'], // Add all supported languages
    features: [
      'Real-time audio translation',
      'Text translation',
      'Voice preservation',
      'Emotion detection',
      'WebSocket streaming',
      'Webhook notifications'
    ]
  });
});

// Export both router and WebSocket handler
module.exports = {
  router,
  handleWebSocketConnection
};
