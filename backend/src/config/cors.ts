// Centralized CORS configuration for Vercel Serverless Functions
export const corsConfig = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://data-room-196e.vercel.app']
    : ['*'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true,
};

// Set CORS headers for Vercel API functions
export const setCorsHeaders = (res: any, origin?: string) => {
  try {
    // Allow specific frontend domain
    const allowedOrigins = [
      'https://data-room-196e.vercel.app',
      'http://localhost:3000', // For local development
    ];
    
    const requestOrigin = origin || '';
    const allowedOrigin = allowedOrigins.includes(requestOrigin) 
      ? requestOrigin 
      : allowedOrigins[0];
    
    console.log('[CORS] Setting headers for origin:', requestOrigin, '->', allowedOrigin);
    
    // Set all required CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  } catch (error) {
    console.error('[CORS] Error setting headers:', error);
    // Fallback to basic headers
    res.setHeader('Access-Control-Allow-Origin', 'https://data-room-196e.vercel.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
};

// Handle preflight OPTIONS requests
export const handlePreflight = (req: any, res: any) => {
  try {
    console.log('[CORS] Handling preflight request:', {
      origin: req.headers.origin,
      method: req.method,
      url: req.url,
      'access-control-request-method': req.headers['access-control-request-method'],
      'access-control-request-headers': req.headers['access-control-request-headers'],
      allHeaders: Object.keys(req.headers)
    });
    
    // Set CORS headers for preflight
    setCorsHeaders(res, req.headers.origin);
    
    // Additional headers for better compatibility
    const origin = req.headers.origin || 'https://data-room-196e.vercel.app';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Log the headers being set
    console.log('[CORS] Headers set:', {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma',
      'Access-Control-Allow-Credentials': 'true'
    });
    
    // Return 200 OK for OPTIONS preflight
    console.log('[CORS] Preflight request handled successfully - returning 200');
    res.status(200).end();
  } catch (error) {
    console.error('[CORS] Error in preflight handling:', error);
    // Even if there's an error, try to set basic CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://data-room-196e.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    console.log('[CORS] Fallback headers set due to error');
    res.status(200).end();
  }
};
