// pages/api/test-env.js
export default function handler(req, res) {
    res.status(200).json({
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      apiKeyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 12) + '...',
      nodeEnv: process.env.NODE_ENV
    });
  }