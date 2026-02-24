import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js"; 
import * as schema from '../db/schema/auth.js'

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error("BETTER_AUTH_SECRET environment variable is required");

const trustedOrigin = process.env.FRONTEND_URL;
if (!trustedOrigin) throw new Error("FRONTEND_URL environment variable is required");

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8000",
    secret,
    trustedOrigins: [trustedOrigin],

    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    emailAndPassword: {
        enabled: true,
    },
    user:{
        additionalFields:{
            role: {
                type: 'string', required: true, defaultValue: 'student', input: false,
            },
            imageCldPubId: {
                type: 'string', required: false, input: true,
            },
        }
    }
});