/**
 * ============================================
 * CORS MIDDLEWARE - Cross-Origin Resource Sharing
 * ============================================
 * 
 * This file handles CORS (Cross-Origin Resource Sharing) for our API.
 * CORS is a security feature that controls which websites can access our API.
 * 
 * For junior developers:
 * - CORS prevents malicious websites from making requests to our API
 * - We need to explicitly allow our frontend domain to access the API
 * - OPTIONS requests are "preflight" requests that browsers send before real requests
 * - This middleware MUST be called at the start of every API handler
 * 
 * Why we need this:
 * - Our frontend runs on https://data-room-196e.vercel.app
 * - Our API runs on Vercel serverless functions
 * - Without CORS, browsers would block our API calls
 */

import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * HANDLE CORS MIDDLEWARE
 * 
 * This function sets up CORS headers and handles preflight requests.
 * It MUST be called at the very beginning of every API handler.
 * 
 * @param req - The incoming request
 * @param res - The response object
 * @returns true if request was handled (OPTIONS), false to continue
 */
export function handleCORS(req: VercelRequest, res: VercelResponse): boolean {
  // Get the origin (website) making the request
  const origin = req.headers.origin || 'https://data-room-196e.vercel.app';
  
  // List of allowed origins (websites that can access our API)
  const allowedOrigins = [
    'https://data-room-196e.vercel.app',  // Production frontend
    'http://localhost:3000',             // Local development
    'http://localhost:3001'              // Alternative local port
  ];
  
  // Check if the request is from an allowed origin
  const allowedOrigin = allowedOrigins.includes(origin) 
    ? origin 
    : 'https://data-room-196e.vercel.app'; // Default to production

  // Set CORS headers for ALL requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');  // Allow cookies/auth
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin); // Allow specific origin
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT'); // Allowed HTTP methods
  res.setHeader('Access-Control-Allow-Headers', 
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, ' +
    'Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Origin, ' +
    'Cache-Control, Pragma'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

  // Handle preflight OPTIONS requests
  // Browsers send these before making real requests to check if they're allowed
  if (req.method === 'OPTIONS') {
    console.log(`[CORS] OPTIONS preflight handled for ${req.url}`);
    res.status(200).end();
    return true; // Signal that we've handled the request completely
  }

  return false; // Continue to the main API handler
}

