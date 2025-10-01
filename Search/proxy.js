
const axios = require('axios');

async function makeRequest(query, requestId) {
  try {
    const config = {
      method: 'post',
      url: 'https://google.serper.dev/search',
      headers: { 
        'X-API-KEY': process.env.SERPER_API_KEY || '', 
        'Content-Type': 'application/json'
      },
      data: { q: query }
    };

    const response = await axios.request(config);
    return {
      requestId,
      data: response.data,
      success: true
    };
  } catch (error) {
    console.error('Search API Error:', error.message);
    return {
      requestId,
      error: 'Search failed',
      success: false
    };
  }
}

module.exports = { makeRequest };
