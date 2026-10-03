import { isDirectPgConnection, redactConnectionString, getRedactedHost } from "../src/lib/backup-engine";

const testUri1 = "postgresql://neondb_owner:npg_lmF8kudMIh2q@ep-mute-poetry-b5ddnbob.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const testUri2 = "postgresql://neondb_owner:npg_lmF8kudMIh2q@ep-mute-poetry-b5ddnbob.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

console.log("URI 1 isDirectPgConnection:", isDirectPgConnection(testUri1));
console.log("URI 1 Redacted Host:", getRedactedHost(testUri1));
console.log("URI 1 Redacted String:", redactConnectionString(testUri1));

console.log("\nURI 2 isDirectPgConnection:", isDirectPgConnection(testUri2));
console.log("URI 2 Redacted Host:", getRedactedHost(testUri2));
console.log("URI 2 Redacted String:", redactConnectionString(testUri2));
