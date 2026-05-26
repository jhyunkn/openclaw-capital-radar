const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');

// Temporary stabilization guard.
// The Macro page redesign should be reintroduced as component-level patches,
// not by destructively rewriting/removing operational sections in this cleanup step.
console.log('Macro consolidation skipped: using canonical homepage renderer output');
