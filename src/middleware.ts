import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth-token')?.value;
  const userRole = request.cookies.get('user-role')?.value;
  const { pathname } = request.nextUrl;

  const isPublicPath = ['/login', '/signup', '/forgot-password', '/otp', '/reset-password'].includes(pathname);
  const isAdminPath = pathname.startsWith('/admin');
  const isWarehousePath = pathname.startsWith('/warehouse');

  // Security: Restrict franchise management routes to super admin only
  // These routes will be further protected by server-side checks in the page components
  const isFranchiseManagementPath = pathname.startsWith('/admin/franchise') && pathname !== '/admin/franchise/[id]';

  // Allow reset-password page - it will check for OTP verification session in the page component
  // OTP verification creates a Supabase session but may not have auth-token cookie
  if (pathname === '/reset-password') {
    return NextResponse.next();
  }

  // Security: Block staff (non-super admin) from accessing admin paths
  if (authToken && userRole === 'staff' && isAdminPath) {
    return NextResponse.redirect(new URL('/warehouse', request.url));
  }

  // If the user is authenticated
  if (authToken) {
    if (isPublicPath) {
      // Redirect based on user role
      if (userRole === 'staff') {
        return NextResponse.redirect(new URL('/warehouse', request.url));
      }
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  } 
  else {
    if (isAdminPath || isWarehousePath) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  // If the user is at the root, redirect based on role
  if(pathname === '/'){
    if (userRole === 'staff') {
      return NextResponse.redirect(new URL('/warehouse', request.url));
    }
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

// import { NextResponse } from 'next/server'
// import type { NextRequest } from 'next/server'

// export function middleware(request: NextRequest) {
//   // Temporarily allow all routes to be accessed publicly
//   return NextResponse.next();
// }

// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except for the ones starting with:
//      * - api (API routes)
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      */
//     '/((?!api|_next/static|_next/image|favicon.ico).*)',
//   ],
// }

