/**
 * Universal Voice Translation API
 * Main routing configuration for all API endpoints
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Import route modules
const sessionsRouter = require('./sessions');
const translationRouter = require('./translation');
const voicesRouter = require('./voices');
const synthesisRouter = require('./synthesis');
const webhooksRouter = require('./webhooks');
const healthRouter = require('./health');

// Import middleware
const apiKeyAuth = require('../middleware/apiKeyAuth');
const errorHandler = require('../middleware/errorHandler');
const requestLogger = require('../middleware/requestLogger');

const router = express.Router();

// Security middleware
router.use(helmet());
router.use(cors({
  origin: true, // Configure based on your needs
  credentials: true
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

const translationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit translation requests
  message: {
    error: 'Translation rate limit exceeded, please try again later.',
    code: 'TRANSLATION_RATE_LIMIT_EXCEEDED'
  }
});

// Apply rate limiting
router.use(apiLimiter);
router.use('/translate', translationLimiter);

// Request logging
router.use(requestLogger);

// API key authentication (except for health check)
router.use('/health', healthRouter);
router.use(apiKeyAuth);

// Mount route modules
router.use('/sessions', sessionsRouter);
router.use('/translate', translationRouter);
router.use('/voices', voicesRouter);
router.use('/synthesize', synthesisRouter);
router.use('/webhooks', webhooksRouter);

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Universal Voice Translation API',
    version: '1.0.0',
    description: 'Real-time voice translation with voice preservation',
    documentation: '/api/docs',
    endpoints: {
      sessions: '/api/sessions',
      translation: '/api/translate',
      voices: '/api/voices',
      synthesis: '/api/synthesize',
      webhooks: '/api/webhooks',
      health: '/api/health'
    },
    features: [
      'Real-time voice translation',
      'Voice characteristic preservation',
      'Emotion detection and preservation',
      'Multi-language support (125+ languages)',
      'WebSocket streaming',
      'Webhook notifications',
      'Session management',
      'Rate limiting and authentication'
    ],
    support: {
      email: 'support@voicetranslation.com',
      documentation: 'https://docs.voicetranslation.com'
    }
  });
});

// Error handling middleware (must be last)
router.use(errorHandler);

module.exports = router;
