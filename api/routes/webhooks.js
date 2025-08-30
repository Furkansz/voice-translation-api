/**
 * Webhook Management API Routes
 * Handles webhook configuration and testing
 */

const express = require('express');
const router = express.Router();

// Import webhook service
const WebhookService = require('../services/webhookService');
const webhookService = new WebhookService();

/**
 * POST /api/webhooks/test
 * Test a webhook endpoint
 */
router.post('/test', async (req, res) => {
  try {
    const { url, secret } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Webhook URL is required',
        code: 'MISSING_WEBHOOK_URL'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid webhook URL format',
        code: 'INVALID_WEBHOOK_URL'
      });
    }

    // Send test webhook
    const testPayload = {
      event: 'webhook.test',
      message: 'This is a test webhook from Voice Translation API',
      timestamp: new Date().toISOString(),
      apiKey: req.clientId,
      testData: {
        success: true,
        version: '1.0.0'
      }
    };

    console.log(`🔗 Testing webhook: ${url}`);

    const result = await webhookService.sendWebhook(url, testPayload, { secret });

    if (result.success) {
      res.json({
        success: true,
        message: 'Webhook test successful',
        webhookId: result.webhookId,
        url,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Webhook test failed',
        error: result.error,
        webhookId: result.webhookId,
        willRetry: result.willRetry
      });
    }

  } catch (error) {
    console.error('❌ Webhook test error:', error);
    res.status(500).json({
      error: 'Webhook test failed',
      code: 'WEBHOOK_TEST_FAILED',
      details: error.message
    });
  }
});

/**
 * GET /api/webhooks/events
 * List available webhook events
 */
router.get('/events', (req, res) => {
  res.json({
    events: [
      {
        name: 'session.created',
        description: 'A new translation session was created',
        payload: {
          sessionId: 'string',
          participants: 'array',
          timestamp: 'string'
        }
      },
      {
        name: 'session.ended',
        description: 'A translation session was ended',
        payload: {
          sessionId: 'string',
          duration: 'number',
          reason: 'string',
          timestamp: 'string'
        }
      },
      {
        name: 'participant.connected',
        description: 'A participant connected to a session',
        payload: {
          sessionId: 'string',
          participantId: 'string',
          timestamp: 'string'
        }
      },
      {
        name: 'participant.disconnected',
        description: 'A participant disconnected from a session',
        payload: {
          sessionId: 'string',
          participantId: 'string',
          timestamp: 'string'
        }
      },
      {
        name: 'transcription.completed',
        description: 'Speech transcription was completed',
        payload: {
          sessionId: 'string',
          participantId: 'string',
          transcription: 'object',
          timestamp: 'string'
        }
      },
      {
        name: 'translation.completed',
        description: 'Text translation was completed',
        payload: {
          sessionId: 'string',
          participantId: 'string',
          translation: 'object',
          timestamp: 'string'
        }
      },
      {
        name: 'synthesis.completed',
        description: 'Voice synthesis was completed',
        payload: {
          sessionId: 'string',
          participantId: 'string',
          audioData: 'string',
          timestamp: 'string'
        }
      },
      {
        name: 'error.occurred',
        description: 'An error occurred during processing',
        payload: {
          sessionId: 'string',
          participantId: 'string',
          error: 'object',
          timestamp: 'string'
        }
      }
    ],
    security: {
      signatureHeader: 'X-Webhook-Signature',
      algorithm: 'sha256',
      example: 'sha256=a1b2c3d4e5f6...'
    },
    retryPolicy: {
      maxRetries: 3,
      baseDelay: '1s',
      maxDelay: '30s',
      backoff: 'exponential'
    }
  });
});

/**
 * POST /api/webhooks/validate
 * Validate webhook signature
 */
router.post('/validate', (req, res) => {
  try {
    const { payload, signature, secret } = req.body;

    if (!payload || !signature || !secret) {
      return res.status(400).json({
        error: 'Payload, signature, and secret are required',
        code: 'MISSING_VALIDATION_DATA'
      });
    }

    const isValid = webhookService.verifySignature(payload, signature, secret);

    res.json({
      valid: isValid,
      signature,
      algorithm: 'sha256',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Webhook validation error:', error);
    res.status(500).json({
      error: 'Webhook validation failed',
      code: 'WEBHOOK_VALIDATION_FAILED',
      details: error.message
    });
  }
});

/**
 * GET /api/webhooks/stats
 * Get webhook service statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = webhookService.getStats();
    
    res.json({
      ...stats,
      status: 'operational',
      supportedEvents: 8,
      securityFeatures: [
        'HMAC SHA-256 signatures',
        'Timestamp verification',
        'Automatic retries',
        'Exponential backoff'
      ]
    });

  } catch (error) {
    console.error('❌ Webhook stats error:', error);
    res.status(500).json({
      error: 'Failed to get webhook stats',
      code: 'WEBHOOK_STATS_FAILED'
    });
  }
});

module.exports = router;
