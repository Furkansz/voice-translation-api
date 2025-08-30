/**
 * Session Management API Routes
 * Handles creation, management, and lifecycle of translation sessions
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Import services
const SessionManager = require('../../server/services/sessionManager');
const ApiSessionManager = require('../services/apiSessionManager');

const sessionManager = new SessionManager();
const apiSessionManager = new ApiSessionManager();

/**
 * POST /api/sessions
 * Create a new translation session
 * 
 * Body:
 * {
 *   "participants": [
 *     {
 *       "id": "user1",
 *       "name": "John Doe", 
 *       "language": "en",
 *       "voiceId": "j9VKhOt1XPLj283lSboj",
 *       "role": "caller" // optional: caller, agent, patient, doctor, etc.
 *     },
 *     {
 *       "id": "user2",
 *       "name": "Ali Kaya",
 *       "language": "tr", 
 *       "voiceId": "DiP1Rqe7XnBlriQqUvQK",
 *       "role": "agent"
 *     }
 *   ],
 *   "metadata": {
 *     "applicationId": "call-center-v1",
 *     "sessionType": "customer_support",
 *     "priority": "normal",
 *     "department": "technical_support"
 *   },
 *   "options": {
 *     "enableEmotionDetection": true,
 *     "enableRecording": false,
 *     "autoTranscript": true,
 *     "webhookUrl": "https://your-app.com/webhooks/translation"
 *   }
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { participants, metadata = {}, options = {} } = req.body;

    // Validation
    if (!participants || participants.length !== 2) {
      return res.status(400).json({
        error: 'Exactly 2 participants are required',
        code: 'INVALID_PARTICIPANTS'
      });
    }

    for (const participant of participants) {
      if (!participant.id || !participant.language || !participant.voiceId) {
        return res.status(400).json({
          error: 'Each participant must have id, language, and voiceId',
          code: 'INVALID_PARTICIPANT_DATA'
        });
      }
    }

    // Create session
    const sessionId = uuidv4();
    const session = await apiSessionManager.createSession({
      sessionId,
      participants,
      metadata: {
        ...metadata,
        apiKey: req.apiKey,
        createdAt: new Date().toISOString(),
        createdBy: req.clientId
      },
      options: {
        enableEmotionDetection: true,
        enableRecording: false,
        autoTranscript: true,
        maxDuration: 3600000, // 1 hour default
        ...options
      }
    });

    console.log(`🔗 API session created: ${sessionId} for ${req.clientId}`);

    res.status(201).json({
      sessionId,
      status: 'created',
      participants: participants.map(p => ({
        id: p.id,
        name: p.name,
        language: p.language,
        role: p.role || 'participant'
      })),
      websocketUrl: `ws://localhost:3001/api/translate?sessionId=${sessionId}`,
      createdAt: session.metadata.createdAt,
      expiresAt: new Date(Date.now() + (options.maxDuration || 3600000)).toISOString()
    });

  } catch (error) {
    console.error('❌ Session creation error:', error);
    res.status(500).json({
      error: 'Failed to create session',
      code: 'SESSION_CREATION_FAILED',
      details: error.message
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get session information and status
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await apiSessionManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Check if client has access to this session
    if (session.metadata.apiKey !== req.apiKey) {
      return res.status(403).json({
        error: 'Access denied to this session',
        code: 'SESSION_ACCESS_DENIED'
      });
    }

    res.json({
      sessionId,
      status: session.status,
      participants: session.participants.map(p => ({
        id: p.id,
        name: p.name,
        language: p.language,
        role: p.role,
        connected: p.connected || false,
        lastActivity: p.lastActivity
      })),
      metadata: {
        createdAt: session.metadata.createdAt,
        duration: Date.now() - new Date(session.metadata.createdAt).getTime(),
        totalMessages: session.stats?.totalMessages || 0,
        totalTranslations: session.stats?.totalTranslations || 0
      },
      options: session.options
    });

  } catch (error) {
    console.error('❌ Session retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve session',
      code: 'SESSION_RETRIEVAL_FAILED'
    });
  }
});

/**
 * GET /api/sessions
 * List all sessions for the authenticated client
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const sessions = await apiSessionManager.listSessions({
      apiKey: req.apiKey,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        status: session.status,
        participantCount: session.participants.length,
        createdAt: session.metadata.createdAt,
        duration: Date.now() - new Date(session.metadata.createdAt).getTime(),
        metadata: session.metadata
      })),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: sessions.length
      }
    });

  } catch (error) {
    console.error('❌ Session listing error:', error);
    res.status(500).json({
      error: 'Failed to list sessions',
      code: 'SESSION_LISTING_FAILED'
    });
  }
});

/**
 * PUT /api/sessions/:sessionId
 * Update session configuration
 */
router.put('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    const session = await apiSessionManager.updateSession(sessionId, updates, req.apiKey);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found or access denied',
        code: 'SESSION_NOT_FOUND'
      });
    }

    res.json({
      sessionId,
      status: 'updated',
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Session update error:', error);
    res.status(500).json({
      error: 'Failed to update session',
      code: 'SESSION_UPDATE_FAILED'
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * End and cleanup a session
 */
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = await apiSessionManager.endSession(sessionId, req.apiKey);

    if (!success) {
      return res.status(404).json({
        error: 'Session not found or access denied',
        code: 'SESSION_NOT_FOUND'
      });
    }

    console.log(`🔚 API session ended: ${sessionId} by ${req.clientId}`);

    res.json({
      sessionId,
      status: 'ended',
      endedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Session deletion error:', error);
    res.status(500).json({
      error: 'Failed to end session',
      code: 'SESSION_DELETION_FAILED'
    });
  }
});

/**
 * POST /api/sessions/:sessionId/participants/:participantId/connect
 * Connect a participant to an existing session
 */
router.post('/:sessionId/participants/:participantId/connect', async (req, res) => {
  try {
    const { sessionId, participantId } = req.params;
    
    const success = await apiSessionManager.connectParticipant(sessionId, participantId, req.apiKey);
    
    if (!success) {
      return res.status(404).json({
        error: 'Session or participant not found',
        code: 'PARTICIPANT_CONNECTION_FAILED'
      });
    }

    res.json({
      sessionId,
      participantId,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      websocketUrl: `ws://localhost:3001/api/translate?sessionId=${sessionId}&participantId=${participantId}`
    });

  } catch (error) {
    console.error('❌ Participant connection error:', error);
    res.status(500).json({
      error: 'Failed to connect participant',
      code: 'PARTICIPANT_CONNECTION_FAILED'
    });
  }
});

module.exports = router;
