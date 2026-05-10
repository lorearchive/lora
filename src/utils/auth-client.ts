import { createAuthClient } from "better-auth/svelte"

export const authClient = createAuthClient({
    baseURL: typeof window !== "undefined" ? import.meta.env.BETTER_AUTH_URL : "" 
});