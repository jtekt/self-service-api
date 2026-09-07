
import NextAuth from "next-auth"
import type { OIDCConfig } from "next-auth/providers"

// Generic OIDC provider, configured via AUTH_OIDC_ID, AUTH_OIDC_SECRET and
// AUTH_OIDC_ISSUER environment variables (auto-detected by Auth.js)
const provider = {
  id: "oidc",
  name: "OIDC",
  type: "oidc",
  // The default sign-in page derives a logo URL from the provider id
  // (https://authjs.dev/img/providers/<id>.svg), which 404s for a generic
  // "oidc" id since it isn't a known vendor slug. Point at a local icon instead.
  style: { logo: "/oidc.svg", bg: "#fff" },
} satisfies OIDCConfig<Record<string, unknown>>

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [provider],
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    authorized: async ({ auth }) => {
      // Logged in users are authenticated, otherwise redirect to /login
      return !!auth?.user
    },
  },
})