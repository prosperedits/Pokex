// sync.mjs — two-way sync this repo with GitHub. Run on EITHER machine:
//   npm run sync
// Pulls the other device's pushed work (rebasing your local commits on top of
// it), then pushes yours. It does NOT auto-commit — commit your work first
// (Claude does that for you). Safe to run anytime; a no-op if nothing changed.
import { execSync } from 'node:child_process';

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', ...opts }).trim();
const run = (cmd) => { console.log(`$ ${cmd}`); execSync(cmd, { stdio: 'inherit' }); };

try {
  const branch = sh('git rev-parse --abbrev-ref HEAD');
  console.log(`↕  syncing "${branch}" with GitHub…`);
  // pull the other machine's work first; --autostash keeps any uncommitted
  // edits safe; --rebase replays your local commits cleanly on top
  run(`git pull --rebase --autostash origin ${branch}`);
  // send anything you've committed locally
  run(`git push origin ${branch}`);
  console.log('✓ in sync with GitHub');
} catch {
  console.error('\n✗ sync hit a conflict. Resolve the files git listed, then run `npm run sync` again.');
  process.exit(1);
}
