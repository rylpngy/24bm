import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const javaHome = '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';

const run = (command, args, options = {}) =>
  new Promise((resolveRun, reject) => {
    console.log(`\n$ ${[command, ...args].join(' ')}`);
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: 'inherit',
      shell: false,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
    });
  });

const javaEnv = {
  ...process.env,
  ...(existsSync(javaHome) ? { JAVA_HOME: javaHome, PATH: `/opt/homebrew/opt/openjdk@21/bin:${process.env.PATH}` } : {}),
};

await run('npm', ['run', 'openapi:check']);
await run('npm', ['test']);
await run('npm', ['run', 'build']);
await run('mvn', ['clean', 'test'], {
  cwd: resolve(root, 'backend-java'),
  env: javaEnv,
});

console.log('\nLocal verification completed.');
