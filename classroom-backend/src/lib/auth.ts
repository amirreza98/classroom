import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { db } from "../db/index.js";
import * as schema from '../db/schema/auth.js'

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error("BETTER_AUTH_SECRET environment variable is required");

const trustedOrigin = process.env.FRONTEND_URL;
if (!trustedOrigin) throw new Error("FRONTEND_URL environment variable is required");

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret,
    trustedOrigins: trustedOrigin.split(','),
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    emailAndPassword: {
        enabled: true,
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        }
    },
    user: {
        additionalFields: {
            role: {
                type: 'string', required: true, defaultValue: 'student', input: false,
            },
            imageCldPubId: {
                type: 'string', required: false, input: true,
            },
        }
    },
    plugins: [
        jwt({
            jwt: {
                expirationTime: "1h",
                definePayload: async ({ user }) => ({
                    role: (user as any).role ?? 'student',
                    email: user.email,
                    name: user.name,
                }),
            },
            jwks: {
                keyPairConfig: { alg: "ES256" },
            },
        }),
    ],
});