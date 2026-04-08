module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/radar', 'http://localhost:3000/tracker'],
      startServerCommand: 'npm run start',
    },
    assert: {
      assertions: {
        'categories:performance': ['error', {minScore: 0.9}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:best-practices': ['error', {minScore: 0.9}],
        'categories:seo': ['error', {minScore: 0.9}],
      },
    },
  },
};
