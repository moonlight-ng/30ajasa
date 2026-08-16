import { createClient } from '@supabase/supabase-js';

import { AppError } from './errors.js';

let cachedClient;
let cachedUrl;
let cachedKey;

function required(env, key) {
    const value = String(env?.[key] || '').trim();
    if (!value) throw new AppError(`Server configuration is missing ${key}.`, 503, 'configuration_error');
    return value;
}

export function getSupabaseClient(env = process.env) {
    const url = required(env, 'SUPABASE_URL').replace(/\/$/, '');
    const serviceRoleKey = required(env, 'SUPABASE_SERVICE_ROLE_KEY');

    if (!cachedClient || cachedUrl !== url || cachedKey !== serviceRoleKey) {
        cachedUrl = url;
        cachedKey = serviceRoleKey;
        cachedClient = createClient(url, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }

    return cachedClient;
}

export function setSupabaseClient(client) {
    cachedClient = client;
    cachedUrl = undefined;
    cachedKey = undefined;
}
