// Credential resolution and storage, heygen-cli style:
//   1. env vars IDOMOO_ACCOUNT_ID / IDOMOO_SECRET_KEY (agents, CI — nothing on disk)
//   2. ~/.strata/credentials (JSON, written by `strata auth login`)
//      falling back to the legacy ~/.idm/credentials when present (pre-rename installs)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const CRED_PATH = join(homedir(), '.strata', 'credentials');
const LEGACY_CRED_PATH = join(homedir(), '.idm', 'credentials');

// The credentials file actually on disk — new location preferred, legacy as fallback.
function activeCredPath() {
    if (existsSync(CRED_PATH)) return CRED_PATH;
    if (existsSync(LEGACY_CRED_PATH)) return LEGACY_CRED_PATH;
    return null;
}

export function loadStoredCredentials() {
    const path = activeCredPath();
    if (!path) return null;
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}

export function resolveCredentials({ account, token } = {}) {
    if (account && token) return { account_id: String(account), secret_key: String(token), source: 'flags' };
    const envA = process.env.IDOMOO_ACCOUNT_ID, envS = process.env.IDOMOO_SECRET_KEY;
    if (envA && envS) return { account_id: envA, secret_key: envS, source: 'env' };
    const stored = loadStoredCredentials();
    if (stored?.account_id && stored?.secret_key)
        return { account_id: String(stored.account_id), secret_key: stored.secret_key, source: activeCredPath() };
    return null;
}

export function storeCredentials(accountId, secretKey) {
    mkdirSync(join(homedir(), '.strata'), { recursive: true });
    writeFileSync(CRED_PATH, JSON.stringify({ account_id: accountId, secret_key: secretKey }, null, 2) + '\n',
        { mode: 0o600 });
    return CRED_PATH;
}

export function hasStoredCredentials() {
    return activeCredPath() !== null;
}
