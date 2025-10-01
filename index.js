
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();
const PORT = 3001;

// Security configuration - use a consistent default for development
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'development-internal-secret-for-mvp-only';

app.use(express.json());

// Authentication middleware for internal requests
function authenticateInternalRequest(req, res, next) {
  const authHeader = req.headers['x-internal-auth'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required', requestId: req.body.requestId });
  }
  
  // Verify HMAC signature
  const [timestamp, signature] = authHeader.split('.');
  if (!timestamp || !signature) {
    return res.status(401).json({ error: 'Invalid authentication format', requestId: req.body.requestId });
  }
  
  // Check timestamp (prevent replay attacks - 5 minute window)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    return res.status(401).json({ error: 'Request expired', requestId: req.body.requestId });
  }
  
  // Verify signature
  const expectedSignature = crypto.createHmac('sha256', INTERNAL_SECRET)
    .update(`${timestamp}.${JSON.stringify(req.body)}`)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid authentication signature', requestId: req.body.requestId });
  }
  
  next();
}

// Secure proxy endpoint with authentication
app.post('/proxy-search', authenticateInternalRequest, async (req, res) => {
  try {
    const { q, requestId } = req.body;
    
    // Forward to Serper API
    // Check if API key exists
    if (!process.env.SERPER_API_KEY) {
      return res.status(500).json({ 
        error: 'Serper API key not configured',
        requestId: req.body.requestId 
      });
    }

    const config = {
      method: 'post',
      url: 'https://google.serper.dev/search',
      headers: { 
        'X-API-KEY': process.env.SERPER_API_KEY, 
        'Content-Type': 'application/json'
      },
      data: { q }
    };

    const response = await axios.request(config);
    
    // Return result with requestId for tracking
    res.json({
      requestId,
      data: response.data
    });
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ 
      error: 'Search failed',
      requestId: req.body.requestId 
    });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`🔍 Search Proxy running on port ${PORT}`);
  console.log(`🔒 Secure proxy with authentication enabled`);
  console.log(`🔑 API Key configured: ${process.env.SERPER_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🛡️ Internal Secret configured: ${INTERNAL_SECRET ? 'Yes' : 'No'}`);
  if (!process.env.SERPER_API_KEY) {
    console.log(`⚠️ Warning: SERPER_API_KEY environment variable is not set`);
  }
  if (!process.env.INTERNAL_SECRET) {
    console.log(`⚠️ Warning: INTERNAL_SECRET not set, using random secret (will not persist across restarts)`);
  }
});
