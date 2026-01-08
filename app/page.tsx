import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function Index() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex flex-col gap-14 max-w-4xl px-3 py-16 lg:py-24 text-foreground">
        <div className="flex flex-col items-center mb-4 lg:mb-12">
          <h1 className="text-5xl lg:text-6xl font-bold text-center mb-4">
            Crownwell AI
          </h1>
          <p className="text-3xl lg:text-4xl !leading-tight mx-auto max-w-xl text-center my-12">
            Chat with your files using <strong>intelligent AI</strong>
          </p>
          {user ? (
            <div className="flex flex-row gap-2">
              <Link
                href="/files"
                className="bg-foreground py-3 px-6 rounded-lg font-mono text-sm text-background"
              >
                Upload
              </Link>
              <Link
                href="/chat"
                className="bg-foreground py-3 px-6 rounded-lg font-mono text-sm text-background"
              >
                Chat
              </Link>
            </div>
          ) : (
            <div className="flex flex-row gap-2">
              <Link
                href="/login"
                className="bg-foreground py-3 px-6 rounded-lg font-mono text-sm text-background hover:opacity-90"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="bg-green-700 py-3 px-6 rounded-lg font-mono text-sm text-white hover:bg-green-600"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
        <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
      </div>
    </div>
  );
}
