import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Protect the main dashboard route
const isProtectedRoute = createRouteMatcher(['/']);

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) {
    auth().protect(); // This will auto-redirect to Clerk's Hosted UI
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
