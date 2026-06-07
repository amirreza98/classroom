import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import * as schema from '../db/schema/auth.js';
import { user } from '../db/schema/auth.js';
import { publishEvent } from '../kafka.js';

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
    databaseHooks: {
        session: {
            create: {
                after: async (session) => {
                    try {
                        const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, session.userId));
                        if (u?.role === 'student') {
                            publishEvent('student.actions', {
                                event: 'student.login',
                                studentId: session.userId,
                                timestamp: new Date().toISOString(),
                            });
                        }
                    } catch {
                        // non-fatal
                    }
                },
            },
        },
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