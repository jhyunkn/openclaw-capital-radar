const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const cadencePath = path.join(root, 'outputs', 'operating-cadence-state.json');
const truthPath = path.join(root, 'outputs', 'data-truth-state.json');
const cadence = JSON.parse(fs.readFileSync(cadencePath, 'utf8'));
const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
const meaningful = Boolean(cadence.meaningfulStateChanged);
const safe = truth.homepageSafeToRender !== false;
const shouldDeploy = meaningful && safe;
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  fs.appendFileSync(githubOutput, `should_deploy=${shouldDeploy}\nmeaningful_state_changed=${meaningful}\nhomepage_safe_to_render=${safe}\n`);
}
console.log(JSON.stringify({ shouldDeploy, meaningfulStateChanged: meaningful, homepageSafeToRender: safe, deployReasons: cadence.deployReasons || [] }, null, 2));
if (!safe) process.exitCode = 2;
