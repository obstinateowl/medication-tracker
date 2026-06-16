import { checkDatabase, logDbHealth } from "./dbHealth.js";

const result = await checkDatabase();
logDbHealth(result);
process.exit(result.ok ? 0 : 1);
