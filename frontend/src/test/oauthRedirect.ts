// Puts the app on the URL Supabase redirects to after Google sign-in (implicit flow: tokens in the hash).
// supabase-js reads that URL once, when its client is created, so a test file must import this module before
// anything that imports the app.
window.history.replaceState(
  null,
  '',
  '/#access_token=google-access-token&refresh_token=google-refresh-token&expires_in=3600&token_type=bearer&type=signup',
);

export {};
