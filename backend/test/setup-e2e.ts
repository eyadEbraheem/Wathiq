// Loaded before every e2e test file: points the app at the test database.
// Create it once with the steps in docs/RUN-LOCALLY.md ("e2e tests").
import { config } from 'dotenv';

config({ path: '.env.test', override: true });

if (!process.env.DATABASE_URL?.includes('_test')) {
  throw new Error(
    'e2e tests must run against a database whose name ends in _test (see backend/.env.test).',
  );
}
