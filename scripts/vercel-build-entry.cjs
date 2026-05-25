const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
function run(command, args) {
  const useShell = command === 'npm' && process.platform === 'win32';
  const executable = useShell ? 'npm' : command;
  console.log('$ ' + executable + ' ' + args.join(' '));
  const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit', shell: useShell });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run('npm', ['run', 'build']);
run(process.execPath, ['scripts/build-canonical-egg-home.cjs']);
run(process.execPath, ['scripts/build-vercel.cjs']);
