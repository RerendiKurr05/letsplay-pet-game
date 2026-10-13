// Local-dev-only stand-in for what WordPress's wp_localize_script() would
// normally inject (see includes/class-petgame-shortcode.php -> enqueue_assets()).
// In the real WordPress page, window.petgameConfig already exists by the
// time app.js runs, pointing at the real /wp-json/petgame/v1/ API.
// This lets you run `npm run dev` and see the UI without WordPress at all —
// api.js below falls back to mock data if a real apiRoot doesn't respond.
window.petgameConfig = {
  apiRoot: 'http://localhost:0/mock/', // intentionally unreachable in dev
  nonce: 'dev-mock-nonce',
  currentUser: { id: 1, name: 'Dev User' },
  assets: {},
  theme: {},
};
