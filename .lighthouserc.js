module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/radar', 
        'http://localhost:3000/tracker'
      ],
      startServerCommand: 'npm run start',
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // This is the specific "Failure Threshold" logic
        'categories:performance': ['error', {minScore: 0.9}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:best-practices': ['error', {minScore: 0.9}],
        'categories:seo': ['error', {minScore: 0.9}],
        
        // You can also disable specific rules that might be too strict
        'offscreen-images': 'off',
        'uses-webp-images': 'off',
      },
    },
  },
};
