import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// This protects all routes EXCEPT the sign-in and sign-up pages
const isProtectedRoute = createRouteMatcher([
  '/((?!sign-in|sign-up).*)'
]);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
