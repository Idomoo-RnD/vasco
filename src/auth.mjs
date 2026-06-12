// Credential resolution and storage, heygen-cli style:
//   1. env vars IDOMOO_ACCOUNT_ID / IDOMOO_SECRET_KEY (agents, CI — nothing on disk)
//   2. ~/.idm/credentials (JSON, written by `idm auth login`)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const CRED_PATH = join(homedir(), '.idm', 'credentials');

export function loadStoredCredentials() {
    try {
        return JSON.parse(readFileSync(CRED_PATH, 'utf8'));
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
        return { account_id: String(stored.account_id), secret_key: stored.secret_key, source: CRED_PATH };
    return null;
}

export function storeCredentials(accountId, secretKey) {
    mkdirSync(join(homedir(), '.idm'), { recursive: true });
    writeFileSync(CRED_PATH, JSON.stringify({ account_id: accountId, secret_key: secretKey }, null, 2) + '\n',
        { mode: 0o600 });
    return CRED_PATH;
}

export function hasStoredCredentials() {
    return existsSync(CRED_PATH);
}
