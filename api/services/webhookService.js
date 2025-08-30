/**
 * Webhook Service
 * Handles sending webhook notifications to client applications
 */

const axios = require('axios');
const crypto = require('crypto');

class WebhookService {
  constructor() {
    this.pendingWebhooks = new Map();
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000  // 30 seconds
    };
    
    // Process webhooks every 5 seconds
    this.processingInterval = setInterval(() => this.processRetries(), 5000);
  }

  /**
   * Send a webhook notification
   */
  async sendWebhook(webhookUrl, payload, options = {}) {
    const webhookId = crypto.randomBytes(16).toString('hex');
    
    const webhookData = {
      id: webhookId,
      url: webhookUrl,
      payload: {
        ...payload,
        id: webhookId,
        timestamp: payload.timestamp || new Date().toISOString()
      },
      attempt: 1,
      maxRetries: options.maxRetries || this.retryConfig.maxRetries,
      signature: this.generateSignature(payload, options.secret),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceTranslation-Webhook/1.0',
        'X-Webhook-ID': webhookId,
        'X-Webhook-Timestamp': payload.timestamp || new Date().toISOString(),
        ...options.headers
      }
    };

    if (webhookData.signature) {
      webhookData.headers['X-Webhook-Signature'] = webhookData.signature;
    }

    try {
      const response = await this.sendWebhookRequest(webhookData);
      
      if (response.success) {
        console.log(`✅ Webhook sent successfully: ${webhookId} to ${webhookUrl}`);
        return { success: true, webhookId, statusCode: response.statusCode };
      } else {
        console.warn(`⚠️ Webhook failed, will retry: ${webhookId} (${response.statusCode})`);
        this.scheduleRetry(webhookData);
        return { success: false, webhookId, willRetry: true };
      }
      
    } catch (error) {
      console.error(`❌ Webhook error: ${webhookId}`, error.message);
      this.scheduleRetry(webhookData);
      return { success: false, webhookId, error: error.message, willRetry: true };
    }
  }

  /**
   * Send webhook request with timeout
   */
  async sendWebhookRequest(webhookData) {
    try {
      const response = await axios.post(webhookData.url, webhookData.payload, {
        headers: webhookData.headers,
        timeout: 10000, // 10 seconds
        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
      });

      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        data: response.data
      };

    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        return { success: false, statusCode: 408, error: 'Timeout' };
      }
      
      if (error.response) {
        return {
          success: false,
          statusCode: error.response.status,
          error: error.response.statusText
        };
      }

      throw error;
    }
  }

  /**
   * Schedule a webhook for retry
   */
  scheduleRetry(webhookData) {
    if (webhookData.attempt >= webhookData.maxRetries) {
      console.error(`❌ Webhook max retries exceeded: ${webhookData.id}`);
      return;
    }

    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, webhookData.attempt - 1),
      this.retryConfig.maxDelay
    );

    webhookData.nextRetry = Date.now() + delay;
    webhookData.attempt++;

    this.pendingWebhooks.set(webhookData.id, webhookData);
    
    console.log(`📅 Webhook retry scheduled: ${webhookData.id} in ${delay}ms (attempt ${webhookData.attempt})`);
  }

  /**
   * Process pending webhook retries
   */
  async processRetries() {
    const now = Date.now();
    const retryPromises = [];

    for (const [webhookId, webhookData] of this.pendingWebhooks.entries()) {
      if (webhookData.nextRetry <= now) {
        retryPromises.push(this.retryWebhook(webhookId, webhookData));
      }
    }

    if (retryPromises.length > 0) {
      await Promise.allSettled(retryPromises);
    }
  }

  /**
   * Retry a failed webhook
   */
  async retryWebhook(webhookId, webhookData) {
    this.pendingWebhooks.delete(webhookId);

    try {
      console.log(`🔄 Retrying webhook: ${webhookId} (attempt ${webhookData.attempt})`);
      
      const response = await this.sendWebhookRequest(webhookData);
      
      if (response.success) {
        console.log(`✅ Webhook retry successful: ${webhookId}`);
      } else {
        console.warn(`⚠️ Webhook retry failed: ${webhookId} (${response.statusCode})`);
        this.scheduleRetry(webhookData);
      }
      
    } catch (error) {
      console.error(`❌ Webhook retry error: ${webhookId}`, error.message);
      this.scheduleRetry(webhookData);
    }
  }

  /**
   * Generate webhook signature for verification
   */
  generateSignature(payload, secret) {
    if (!secret) return null;

    const payloadString = JSON.stringify(payload);
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature, secret) {
    if (!secret || !signature) return false;

    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Get webhook statistics
   */
  getStats() {
    return {
      pendingRetries: this.pendingWebhooks.size,
      retryConfig: this.retryConfig
    };
  }

  /**
   * Clear all pending webhooks
   */
  clearPending() {
    this.pendingWebhooks.clear();
    console.log('🧹 Cleared all pending webhooks');
  }

  /**
   * Shutdown webhook service
   */
  shutdown() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    console.log(`🔚 Webhook service shutdown. ${this.pendingWebhooks.size} webhooks abandoned.`);
    this.pendingWebhooks.clear();
  }
}

module.exports = WebhookService;
