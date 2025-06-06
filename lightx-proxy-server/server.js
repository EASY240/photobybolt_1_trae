// server.js
const express = require('express');
const cors = require('cors');
// Use node-fetch v2 syntax for CommonJS
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Your Vite dev server
  credentials: true
}));
app.use(express.json());

// Generic LightX API proxy endpoint (similar to serverless function approach)
app.post('/api/lightx-proxy', async (req, res) => {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    const { endpoint, body } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }
    
    const lightxUrl = `https://api.lightxeditor.com/external/api/${endpoint}`;
    
    console.log(`Proxying to: ${lightxUrl}`);
    console.log(`Request body:`, JSON.stringify(body));
    
    // Use the full API key
    const apiKey = process.env.LIGHTX_API_KEY.trim();
    
    console.log(`Using API key (masked): ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };
    
    console.log('Request headers:', headers);
    
    const response = await fetch(lightxUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data));
    
    if (!response.ok) {
      console.error('LightX API Error:', data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy server error', details: error.message });
  }
});

// Keep the original endpoints for backward compatibility
app.post('/api/lightx/v1/*', async (req, res) => {
  try {
    const endpoint = req.params[0];
    const lightxUrl = `https://api.lightxeditor.com/external/api/v1/${endpoint}`;
    
    console.log(`Proxying to: ${lightxUrl}`);
    console.log(`Request body:`, JSON.stringify(req.body));
    
    // Use the full API key without splitting it
    const apiKey = process.env.LIGHTX_API_KEY.trim();
    
    console.log(`Using full API key (masked): ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
    console.log(`Request URL: ${lightxUrl}`);
    console.log(`Request body: ${JSON.stringify(req.body)}`);
    console.log(`Request method: POST`);
    console.log(`Content-Type: application/json`);
    
    // Try with different header combinations
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    };
    
    console.log('Request headers:', headers);
    
    const response = await fetch(lightxUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body),
    });

    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data));
    
    if (!response.ok) {
      console.error('LightX API Error:', data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy server error', details: error.message });
  }
});

app.post('/api/lightx/v2/*', async (req, res) => {
  try {
    const endpoint = req.params[0];
    const lightxUrl = `https://api.lightxeditor.com/external/api/v2/${endpoint}`;
    
    console.log(`Proxying to: ${lightxUrl}`);
    console.log(`Request body:`, JSON.stringify(req.body));
    
    // Log the API key (without revealing the full key for security)
    const apiKey = process.env.LIGHTX_API_KEY;
    console.log(`Using API key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
    
    // Try with different header combinations
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
    };
    
    console.log('Request headers:', headers);
    
    const response = await fetch(lightxUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body),
    });

    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data));
    
    if (!response.ok) {
      console.error('LightX API Error:', data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy server error', details: error.message });
  }
});

// Special handler for image uploads (PUT requests to S3)
app.put('/api/upload-proxy', async (req, res) => {
  try {
    const { uploadUrl } = req.query;
    
    if (!uploadUrl) {
      return res.status(400).json({ error: 'Upload URL is required' });
    }

    // Forward the request to S3
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': req.headers['content-type'],
        'Content-Length': req.headers['content-length'],
      },
      body: req.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('S3 Upload Error:', errorText);
      return res.status(response.status).json({ error: 'Upload failed', details: errorText });
    }

    res.status(200).json({ message: 'Upload successful' });
  } catch (error) {
    console.error('Upload Proxy Error:', error);
    res.status(500).json({ error: 'Upload proxy error', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
