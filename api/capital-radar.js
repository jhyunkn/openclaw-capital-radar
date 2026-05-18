const { buildLiveState } = require('../lib/capital-radar-live.cjs');

module.exports = async function handler(req, res) {
  try {
    const state = await buildLiveState();
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json(state);
  } catch (error) {
    res.status(500).json({ error: error.message, generatedAt: new Date().toISOString() });
  }
};
