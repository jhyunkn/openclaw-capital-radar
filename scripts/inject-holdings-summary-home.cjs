// Compatibility wrapper: holdings-only.
// Homepage orchestration now lives in scripts/render-capital-radar-home.cjs and
// config/homepage-sections.json. Do not add non-holdings sections here.
require('./generate-research-universe-state.cjs');
require('./run-research-collectors-safe.cjs');
require('./generate-institutional-source-states.cjs');
require('./generate-holding-zone-state.cjs');
require('./validate-holding-zone-state.cjs');
require('./inject-strong-holdings-cards-home.cjs');
require('./strip-holdings-role-method-home.cjs');
