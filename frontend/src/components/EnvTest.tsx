// Test component to check environment variables
import React from 'react';

const EnvTest: React.FC = () => {
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    REACT_APP_SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL,
    location: window.location.href,
    hostname: window.location.hostname,
    allEnvVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', margin: '20px' }}>
      <h3>Environment Variables Debug</h3>
      <pre>{JSON.stringify(envInfo, null, 2)}</pre>
    </div>
  );
};

export default EnvTest;
