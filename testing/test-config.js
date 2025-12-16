/**
 * Test Configuration - Configuration examples and settings
 */

const config = {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
    retries: 3,
    environment: process.env.NODE_ENV || 'development',
    
    features: {
        logging: true,
        caching: false,
        analytics: true
    },
    
    database: {
        host: 'localhost',
        port: 5432,
        name: 'testdb',
        pool: {
            min: 2,
            max: 10
        }
    },
    
    getFeature: function(featureName) {
        return this.features[featureName] || false;
    },
    
    isProduction: function() {
        return this.environment === 'production';
    }
};

module.exports = config;
























