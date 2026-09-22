process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-min-32-characters";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-min-32-characters";
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.LOG_LEVEL = "silent";

import { loadEnv, resetEnvForTests } from "../config/env.js";

resetEnvForTests();
loadEnv();
