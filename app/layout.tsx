import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider 
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#a855f7',
          colorBackground: '#0B0F19',
        }
      }}
    >
      <html lang="en">
        <body>
          {/* If the user is NOT logged in, immediately bounce them to the Clerk Portal */}
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>

          {/* If the user IS logged in, render the Rova Dashboard */}
          <SignedIn>
            {children}
          </SignedIn>
        </body>
      </html>
    </ClerkProvider>
  )
}
