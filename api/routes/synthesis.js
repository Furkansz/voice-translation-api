/**
 * Voice Synthesis API Routes
 * Handles text-to-speech synthesis requests
 */

const express = require('express');
const router = express.Router();

// Import synthesis service
const StreamingSynthesisService = require('../../server/services/streamingSynthesisService');
const synthesisService = new StreamingSynthesisService();

/**
 * POST /api/synthesize
 * Convert text to speech using specified voice
 */
router.post('/', async (req, res) => {
  try {
    const {
      text,
      voiceId,
      language = 'en',
      options = {}
    } = req.body;

    // Validation
    if (!text) {
      return res.status(400).json({
        error: 'Text is required',
        code: 'MISSING_TEXT'
      });
    }

    if (!voiceId) {
      return res.status(400).json({
        error: 'Voice ID is required',
        code: 'MISSING_VOICE_ID'
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        error: 'Text too long (max 5000 characters)',
        code: 'TEXT_TOO_LONG'
      });
    }

    // Prepare synthesis options
    const synthesisOptions = {
      emotion: options.emotion || 'neutral',
      speed: Math.max(0.5, Math.min(2.0, options.speed || 1.0)),
      pitch: Math.max(0.5, Math.min(2.0, options.pitch || 1.0)),
      stability: Math.max(0.0, Math.min(1.0, options.stability || 0.75)),
      similarity_boost: Math.max(0.0, Math.min(1.0, options.similarity_boost || 0.85)),
      style: Math.max(0.0, Math.min(1.0, options.style || 0.2))
    };

    console.log(`🎤 API synthesis request: "${text.substring(0, 50)}..." using voice ${voiceId}`);

    // Create emotional profile if emotion is specified
    let emotionalProfile = null;
    if (options.emotion && options.emotion !== 'neutral') {
      emotionalProfile = {
        primaryEmotion: options.emotion,
        intensity: options.intensity || 0.7,
        confidence: 0.9,
        tonality: options.tonality || 'balanced',
        voiceSettings: {
          stability: synthesisOptions.stability,
          similarity_boost: synthesisOptions.similarity_boost,
          style: synthesisOptions.style
        }
      };
    }

    // Synthesize audio
    const startTime = Date.now();
    const audioBuffer = await synthesisService.synthesizeChunk(
      voiceId,
      text,
      language,
      emotionalProfile
    );

    if (!audioBuffer) {
      return res.status(500).json({
        error: 'Synthesis failed',
        code: 'SYNTHESIS_FAILED'
      });
    }

    const duration = Date.now() - startTime;
    const audioBase64 = audioBuffer.toString('base64');

    console.log(`✅ API synthesis completed in ${duration}ms: ${audioBase64.length} bytes`);

    res.json({
      success: true,
      audioData: audioBase64,
      format: 'mp3',
      duration: duration,
      language,
      voiceId,
      text: text.length > 100 ? text.substring(0, 100) + '...' : text,
      options: synthesisOptions,
      metadata: {
        synthesisTime: duration,
        audioSize: audioBase64.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ API synthesis error:', error);
    
    // Handle specific ElevenLabs errors
    if (error.response && error.response.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'SYNTHESIS_RATE_LIMIT',
        retryAfter: 60
      });
    }

    if (error.response && error.response.status === 401) {
      return res.status(500).json({
        error: 'Synthesis service authentication failed',
        code: 'SYNTHESIS_AUTH_FAILED'
      });
    }

    res.status(500).json({
      error: 'Synthesis failed',
      code: 'SYNTHESIS_FAILED',
      details: error.message
    });
  }
});

/**
 * POST /api/synthesize/batch
 * Synthesize multiple texts in a batch
 */
router.post('/batch', async (req, res) => {
  try {
    const { requests, options = {} } = req.body;

    if (!requests || !Array.isArray(requests)) {
      return res.status(400).json({
        error: 'Requests array is required',
        code: 'MISSING_REQUESTS'
      });
    }

    if (requests.length > 10) {
      return res.status(400).json({
        error: 'Too many requests (max 10 per batch)',
        code: 'TOO_MANY_REQUESTS'
      });
    }

    // Validate each request
    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      if (!req.text || !req.voiceId) {
        return res.status(400).json({
          error: `Request ${i}: text and voiceId are required`,
          code: 'INVALID_BATCH_REQUEST'
        });
      }
    }

    console.log(`🎤 API batch synthesis: ${requests.length} requests`);

    // Process all requests
    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      
      try {
        const audioBuffer = await synthesisService.synthesizeChunk(
          request.voiceId,
          request.text,
          request.language || 'en'
        );

        if (audioBuffer) {
          results.push({
            index: i,
            success: true,
            audioData: audioBuffer.toString('base64'),
            text: request.text.length > 50 ? request.text.substring(0, 50) + '...' : request.text,
            voiceId: request.voiceId,
            language: request.language || 'en'
          });
        } else {
          results.push({
            index: i,
            success: false,
            error: 'Synthesis failed',
            text: request.text.length > 50 ? request.text.substring(0, 50) + '...' : request.text
          });
        }

        // Small delay to avoid rate limiting
        if (i < requests.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        console.error(`❌ Batch synthesis error for request ${i}:`, error);
        results.push({
          index: i,
          success: false,
          error: error.message,
          text: request.text.length > 50 ? request.text.substring(0, 50) + '...' : request.text
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;

    console.log(`✅ API batch synthesis completed: ${successful}/${requests.length} successful in ${totalDuration}ms`);

    res.json({
      success: true,
      results,
      summary: {
        total: requests.length,
        successful,
        failed: requests.length - successful,
        totalTime: totalDuration,
        averageTime: totalDuration / requests.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ API batch synthesis error:', error);
    res.status(500).json({
      error: 'Batch synthesis failed',
      code: 'BATCH_SYNTHESIS_FAILED',
      details: error.message
    });
  }
});

/**
 * GET /api/synthesize/test
 * Test endpoint for synthesis service
 */
router.get('/test', async (req, res) => {
  try {
    const testText = 'This is a test of the voice synthesis API.';
    const testVoiceId = 'j9VKhOt1XPLj283lSboj'; // Default English voice

    const audioBuffer = await synthesisService.synthesizeChunk(
      testVoiceId,
      testText,
      'en'
    );

    if (audioBuffer) {
      res.json({
        success: true,
        message: 'Synthesis service is working',
        testAudioSize: audioBuffer.length,
        voiceId: testVoiceId,
        text: testText
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Synthesis service test failed',
        code: 'SYNTHESIS_TEST_FAILED'
      });
    }

  } catch (error) {
    console.error('❌ Synthesis test error:', error);
    res.status(500).json({
      success: false,
      message: 'Synthesis service test failed',
      error: error.message,
      code: 'SYNTHESIS_TEST_FAILED'
    });
  }
});

/**
 * GET /api/synthesize/stats
 * Get synthesis service statistics
 */
router.get('/stats', (req, res) => {
  try {
    // In a real implementation, this would pull from service metrics
    res.json({
      service: 'ElevenLabs Text-to-Speech',
      status: 'operational',
      supportedLanguages: ['en', 'tr', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar'],
      features: {
        emotionSupport: true,
        voiceCloning: true,
        streaming: true,
        batchProcessing: true
      },
      limits: {
        maxTextLength: 5000,
        maxBatchSize: 10,
        rateLimitPerMinute: 100
      },
      currentLoad: 'low', // Would be calculated from actual metrics
      averageLatency: '800ms',
      uptime: '99.9%'
    });

  } catch (error) {
    console.error('❌ Synthesis stats error:', error);
    res.status(500).json({
      error: 'Failed to get synthesis stats',
      code: 'SYNTHESIS_STATS_FAILED'
    });
  }
});

module.exports = router;
