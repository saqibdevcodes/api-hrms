/**
 * Cron Job: Finalize Staging Records
 * 
 * This script should be run daily (or hourly) to finalize staging records
 * that are 1+ day old and move them to the final tables.
 * 
 * Setup with cron:
 * 0 2 * * * cd /home/saqib/public_html/test.iriscommunications.cloud && node dist/cron/finalizeStagingRecords.js
 * 
 * Or use node-cron in the main app
 */

import { finalizationService } from "../services/finalizationService";

async function runFinalization() {
  console.log("========================================");
  console.log("🕐 Finalization Cron Job Started");
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log("========================================\n");

  try {
    const result = await finalizationService.finalizeStagingRecords();

    console.log("\n========================================");
    console.log("📊 Finalization Results:");
    console.log(`✅ Success: ${result.success}`);
    console.log(`📝 Finalized: ${result.finalized} records`);
    console.log(`❌ Errors: ${result.errors} records`);
    console.log("========================================");

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("\n========================================");
    console.error("❌ Finalization Failed:");
    console.error(error);
    console.error("========================================");
    process.exit(1);
  }
}

runFinalization();



