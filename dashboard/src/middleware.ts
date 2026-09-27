export { default } from 'next-auth/middleware';

// Protege todo el dashboard excepto /login y las rutas internas de auth.
export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
