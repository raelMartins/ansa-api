import { getPool } from "../../db/pool.js";
import { serviceUnavailable } from "../../shared/errors.js";

export type HealthStatus = {
  status: "ok";
  service: "ansa-api";
};

export function liveness(): HealthStatus {
  return { status: "ok", service: "ansa-api" };
}

export async function readiness(): Promise<HealthStatus> {
  try {
    await getPool().query("SELECT 1");
  } catch {
    throw serviceUnavailable("Database unavailable");
  }
  return { status: "ok", service: "ansa-api" };
}
