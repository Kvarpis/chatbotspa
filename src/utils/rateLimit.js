// Simple in-memory rate limiting
const rateLimitMap = new Map();

export async function rateLimit(identifier) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 10; // 10 requests per window

  // Get the user's request history
  const userRequests = rateLimitMap.get(identifier) || [];

  // Filter out old requests
  const recentRequests = userRequests.filter(
    timestamp => now - timestamp < windowMs
  );

  // Check if user has exceeded rate limit
  if (recentRequests.length >= maxRequests) {
    return { success: false };
  }

  // Add current request timestamp
  recentRequests.push(now);
  rateLimitMap.set(identifier, recentRequests);

  return { success: true };
}