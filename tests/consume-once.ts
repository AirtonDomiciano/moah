import { parentPort, workerData } from "node:worker_threads";
import { consumeApprovalNow } from "../src/infrastructure/governance-store.js";

const data = workerData as { filePath: string; id: string; fingerprint: string; nowIso: string };
const consumed = consumeApprovalNow(data.filePath, data.id, data.fingerprint, data.nowIso);
parentPort?.postMessage(consumed);
