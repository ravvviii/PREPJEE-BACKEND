import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTransaction } from '../src/utils/transaction.js';

const seedsDir = path.dirname(fileURLToPath(import.meta.url));

// Each seed file lives in this folder, matches `*.seed.js`, and exports an
// async `seed(client)`. Files run in filename order — prefix with numbers
// (001_subjects.seed.js, 002_classes.seed.js, ...) to control ordering once
// Phase 3 adds real seed data.
const run = async () => {
  const files = (await readdir(seedsDir)).filter((file) => file.endsWith('.seed.js')).sort();

  if (files.length === 0) {
    console.log('[Seed] No seed files found in seeds/ — nothing to run.');
    return;
  }

  for (const file of files) {
    const { seed } = await import(path.join(seedsDir, file));
    console.log(`[Seed] Running ${file}`);
    await withTransaction((client) => seed(client));
    console.log(`[Seed] Completed ${file}`);
  }

  console.log('[Seed] All seed files completed.');
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Seed] Failed:', error);
    process.exit(1);
  });
