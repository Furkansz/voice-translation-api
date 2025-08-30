/**
 * API Key Management System
 * Create, manage, and monitor API keys for your customers
 */

const { createApiKey, revokeApiKey, listApiKeys } = require('../middleware/apiKeyAuth');

class APIKeyManager {
  /**
   * Create a new API key for a customer
   */
  static createCustomerKey(customerData) {
    const keyData = createApiKey({
      clientId: customerData.companyName.toLowerCase().replace(/\s+/g, '_'),
      name: customerData.companyName,
      environment: customerData.environment || 'live',
      permissions: customerData.permissions || ['sessions', 'translate', 'synthesize'],
      rateLimit: {
        requestsPerMinute: customerData.tier === 'premium' ? 5000 : 1000,
        translationsPerMinute: customerData.tier === 'premium' ? 500 : 100
      },
      metadata: {
        customerEmail: customerData.email,
        industry: customerData.industry, // 'healthcare', 'call-center', 'education'
        tier: customerData.tier || 'standard',
        createdBy: 'admin'
      }
    });

    console.log(`🔑 New API key created for ${customerData.companyName}:`);
    console.log(`   Key: ${keyData.key}`);
    console.log(`   Tier: ${customerData.tier || 'standard'}`);
    console.log(`   Industry: ${customerData.industry}`);
    
    return keyData;
  }

  /**
   * Example: Create keys for different types of customers
   */
  static createExampleKeys() {
    // Call Center Company
    const callCenterKey = this.createCustomerKey({
      companyName: 'Global Call Center Inc',
      email: 'tech@globalcallcenter.com',
      industry: 'call-center',
      tier: 'premium',
      environment: 'live'
    });

    // Hospital/Telemedicine
    const hospitalKey = this.createCustomerKey({
      companyName: 'Metro Hospital',
      email: 'it@metrohospital.com', 
      industry: 'healthcare',
      tier: 'premium',
      environment: 'live'
    });

    // Small Business
    const smallBizKey = this.createCustomerKey({
      companyName: 'Local Business',
      email: 'owner@localbusiness.com',
      industry: 'general',
      tier: 'standard',
      environment: 'live'
    });

    return {
      callCenter: callCenterKey.key,
      hospital: hospitalKey.key,
      smallBusiness: smallBizKey.key
    };
  }

  /**
   * Get usage statistics for all customers
   */
  static getCustomerUsage() {
    const allKeys = listApiKeys();
    
    return allKeys.map(keyData => ({
      company: keyData.name,
      industry: keyData.metadata?.industry,
      tier: keyData.metadata?.tier,
      active: keyData.active,
      totalRequests: keyData.totalRequests || 0,
      lastUsed: keyData.lastUsed,
      keyPrefix: keyData.keyPrefix
    }));
  }
}

module.exports = APIKeyManager;
