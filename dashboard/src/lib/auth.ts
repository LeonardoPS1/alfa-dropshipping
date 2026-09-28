import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { DEFAULT_TENANT_ID, resolveTenantId } from './tenantContext';

export { resolveTenantId } from './tenantContext';

// Auth de un solo usuario admin (vos) — sin registro público. Si más
// adelante se abre a más gente, esto se reemplaza por una tabla
// dashboard_users, pero para el panel personal esto alcanza.
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null;
        const validEmail = credentials.email === process.env.DASHBOARD_ADMIN_EMAIL;
        const validPassword = await bcrypt.compare(
          credentials.password,
          process.env.DASHBOARD_ADMIN_PASSWORD_HASH ?? ''
        );
        if (validEmail && validPassword) {
          return { id: '1', email: credentials.email };
        }
        return null;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getAuthenticatedTenantId() {
  const session = await getServerSession(authOptions);
  return { session, tenantId: session ? resolveTenantId(session, process.env.ALFA_TENANT_ID ?? DEFAULT_TENANT_ID) : null };
}
