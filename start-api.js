/**
 * Simple startup script for production deployment
 * This will start ONLY the API server (not the React client)
 */

const VoiceTranslationAPI = require('./api/server');

// Get port from environment or use 3002
const port = process.env.PORT || 3002;

console.log('🚀 Starting Voice Translation API...');
console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`🌐 Port: ${port}`);

// Create and start the API server
const api = new VoiceTranslationAPI({
  port: port,
  host: '0.0.0.0' // Important for DigitalOcean
});

api.start()
  .then(() => {
    console.log('\n✅ Voice Translation API is live!');
    console.log(`🌍 Your API is ready to accept connections`);
  })
  .catch((error) => {
    console.error('❌ Failed to start API:', error);
    process.exit(1);
  });
