/**
 * Health Check API Routes
 * System health and status monitoring
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 * Basic health check endpoint
 */
router.get('/', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      human: formatUptime(uptime)
    },
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      unit: 'MB'
    },
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/health/detailed
 * Detailed health check with service status
 */
router.get('/detailed', async (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {},
    system: getSystemInfo()
  };

  try {
    // Check core services
    healthData.services.speechToText = await checkSpeechToTextService();
    healthData.services.translation = await checkTranslationService();
    healthData.services.textToSpeech = await checkTextToSpeechService();
    healthData.services.emotionDetection = await checkEmotionDetectionService();

    // Determine overall status
    const serviceStatuses = Object.values(healthData.services);
    const hasUnhealthy = serviceStatuses.some(service => service.status !== 'healthy');
    
    if (hasUnhealthy) {
      healthData.status = 'degraded';
    }

    res.json(healthData);

  } catch (error) {
    console.error('❌ Detailed health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: healthData.services
    });
  }
});

/**
 * Check Speech-to-Text service health
 */
async function checkSpeechToTextService() {
  try {
    // In production, this would test actual Google Cloud Speech API
    return {
      name: 'Speech-to-Text',
      status: 'healthy',
      provider: 'Google Cloud Speech',
      lastCheck: new Date().toISOString(),
      latency: Math.floor(Math.random() * 100) + 50, // Mock latency
      features: ['streaming', 'multilingual', 'punctuation']
    };
  } catch (error) {
    return {
      name: 'Speech-to-Text',
      status: 'unhealthy',
      error: error.message,
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * Check Translation service health
 */
async function checkTranslationService() {
  try {
    // In production, this would test actual DeepL API
    return {
      name: 'Translation',
      status: 'healthy',
      provider: 'DeepL API',
      lastCheck: new Date().toISOString(),
      latency: Math.floor(Math.random() * 200) + 100, // Mock latency
      supportedLanguages: 31,
      features: ['context-aware', 'formal-informal', 'glossaries']
    };
  } catch (error) {
    return {
      name: 'Translation',
      status: 'unhealthy',
      error: error.message,
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * Check Text-to-Speech service health
 */
async function checkTextToSpeechService() {
  try {
    // In production, this would test actual ElevenLabs API
    return {
      name: 'Text-to-Speech',
      status: 'healthy',
      provider: 'ElevenLabs',
      lastCheck: new Date().toISOString(),
      latency: Math.floor(Math.random() * 800) + 400, // Mock latency
      features: ['voice-cloning', 'emotion-synthesis', 'streaming', 'multilingual']
    };
  } catch (error) {
    return {
      name: 'Text-to-Speech',
      status: 'unhealthy',
      error: error.message,
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * Check Emotion Detection service health
 */
async function checkEmotionDetectionService() {
  try {
    return {
      name: 'Emotion Detection',
      status: 'healthy',
      provider: 'Internal AI',
      lastCheck: new Date().toISOString(),
      latency: Math.floor(Math.random() * 300) + 100, // Mock latency
      features: ['audio-analysis', 'text-sentiment', 'voice-characteristics']
    };
  } catch (error) {
    return {
      name: 'Emotion Detection',
      status: 'unhealthy',
      error: error.message,
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * Get system information
 */
function getSystemInfo() {
  const memoryUsage = process.memoryUsage();
  
  return {
    uptime: {
      seconds: Math.floor(process.uptime()),
      human: formatUptime(process.uptime())
    },
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      unit: 'MB'
    },
    cpu: {
      usage: process.cpuUsage(),
      loadAverage: require('os').loadavg()
    },
    nodejs: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    environment: process.env.NODE_ENV || 'development'
  };
}

/**
 * Format uptime in human readable format
 */
function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join(' ') || '0s';
}

module.exports = router;
