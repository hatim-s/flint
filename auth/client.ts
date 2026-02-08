import { createAuthClient } from "better-auth/react";
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3005",
});

const {
    signIn,
    signOut,
    signUp,
    useSession,
    getSession,
} = authClient;

export {
    authClient,
    signIn,
    signOut,
    signUp,
    useSession,
    getSession,
};
