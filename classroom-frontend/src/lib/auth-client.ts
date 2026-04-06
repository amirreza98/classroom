import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "../../../classroom-backend/src/lib/auth";

export const authClient = createAuthClient({
    baseURL: window.location.origin,
    plugins: [
        inferAdditionalFields<typeof auth>()
    ]
});

export const { signIn, signUp, signOut, useSession } = authClient;