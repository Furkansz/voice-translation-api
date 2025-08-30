/**
 * Universal Voice Translation API Server
 * Main entry point for the API service
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Import API routes and services
const apiRoutes = require('./routes/index');
const { handleWebSocketConnection } = require('./routes/translation');
const ApiSessionManager = require('./services/apiSessionManager');
const WebhookService = require('./services/webhookService');

// Import existing services
const config = require('../server/config');

class VoiceTranslationAPI {
  constructor(options = {}) {
    this.port = options.port || config.API_PORT || 3002;
    this.host = options.host || '0.0.0.0';
    
    // Initialize services
    this.apiSessionManager = new ApiSessionManager();
    this.webhookService = new WebhookService();
    
    // Setup Express app
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    // Setup HTTP server
    this.server = http.createServer(this.app);
    
    // Setup WebSocket server
    this.setupWebSocket();
    
    // Graceful shutdown handling
    this.setupGracefulShutdown();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Basic middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode >= 400 ? '❌' : '✅';
        console.log(`${status} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      
      next();
    });

    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          api: 'running',
          websocket: 'running',
          sessions: this.apiSessionManager.getOverallStats(),
          webhooks: this.webhookService.getStats()
        }
      });
    });

    // API documentation
    this.app.get('/docs', (req, res) => {
      res.sendFile(path.join(__dirname, '../API_DOCUMENTATION.md'));
    });

    // Mount API routes
    this.app.use('/api', apiRoutes);

    // Catch-all for undefined routes
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        code: 'ENDPOINT_NOT_FOUND',
        message: `${req.method} ${req.originalUrl} is not a valid API endpoint`,
        availableEndpoints: [
          'GET /health',
          'GET /docs', 
          'GET /api',
          'POST /api/sessions',
          'GET /api/sessions',
          'WebSocket /api/translate'
        ]
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('❌ Unhandled API error:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Setup WebSocket server for real-time translation
   */
  setupWebSocket() {
    this.wss = new WebSocket.Server({
      server: this.server,
      path: '/api/translate'
    });

    this.wss.on('connection', (ws, req) => {
      handleWebSocketConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });

    console.log('🔌 WebSocket server setup for /api/translate');
  }

  /**
   * Start the API server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.port, this.host, () => {
          console.log('\n🚀 Universal Voice Translation API Server Started!');
          console.log(`📍 HTTP Server: http://${this.host}:${this.port}`);
          console.log(`🔌 WebSocket: ws://${this.host}:${this.port}/api/translate`);
          console.log(`📚 Documentation: http://${this.host}:${this.port}/docs`);
          console.log(`❤️ Health Check: http://${this.host}:${this.port}/health`);
          console.log('\n🌍 Ready to enable universal voice translation!');
          
          resolve(this);
        });

        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`❌ Port ${this.port} is already in use`);
          } else {
            console.error('❌ Server startup error:', error);
          }
          reject(error);
        });

      } catch (error) {
        console.error('❌ Failed to start API server:', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the API server
   */
  async stop() {
    console.log('\n🔄 Shutting down API server...');

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      console.log('🔌 WebSocket server closed');
    }

    // Shutdown services
    if (this.apiSessionManager) {
      this.apiSessionManager.shutdown();
    }

    if (this.webhookService) {
      this.webhookService.shutdown();
    }

    // Close HTTP server
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('🔚 API server stopped');
        resolve();
      });
    });
  }

  /**
   * Setup graceful shutdown handling
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n🔄 Received ${signal}, starting graceful shutdown...`);
      
      try {
        await this.stop();
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Get API server statistics
   */
  getStats() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: this.wss ? this.wss.clients.size : 0,
      sessions: this.apiSessionManager.getOverallStats(),
      webhooks: this.webhookService.getStats()
    };
  }
}

// Export both the class and a convenience function
module.exports = VoiceTranslationAPI;

// If running directly, start the server
if (require.main === module) {
  const api = new VoiceTranslationAPI({
    port: process.env.API_PORT || 3002
  });

  api.start().catch(error => {
    console.error('❌ Failed to start API server:', error);
    process.exit(1);
  });
}
