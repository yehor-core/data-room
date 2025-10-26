import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * CORS middleware - MUST be called at the very start of every API handler
 */
export function handleCORS(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin || 'https://data-room-196e.vercel.app';
  
  // Allow specific origins
  const allowedOrigins = [
    'https://data-room-196e.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const allowedOrigin = allowedOrigins.includes(origin) 
    ? origin 
    : 'https://data-room-196e.vercel.app';

  // Set CORS headers for ALL requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, ' +
    'Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Origin, ' +
    'Cache-Control, Pragma'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  // If it's an OPTIONS request, respond immediately
  if (req.method === 'OPTIONS') {
    console.log(`[CORS] OPTIONS preflight handled for ${req.url}`);
    res.status(200).end();
    return true; // Signal that we've handled the request
  }

  return false; // Continue to main handler
}

