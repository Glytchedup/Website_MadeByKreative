// Manual one-off Etsy sync runner (same logic as the cron endpoint).
// Usage: npm run etsy:sync
import { runFullSync } from "../src/lib/etsy/sync";

runFullSync()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
