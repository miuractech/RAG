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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cookie modifications are not allowed in layouts/pages
            // This is expected and handled by Next.js route handlers
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex flex-col gap-16 max-w-5xl px-4 py-16 lg:py-32 text-foreground">
        <div className="flex flex-col items-center mb-4 lg:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <span>✨</span>
            <span>Powered by Advanced AI</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold text-center mb-6 leading-tight">
            Crownwell AI
          </h1>
          <p className="text-xl lg:text-2xl text-muted-foreground max-w-2xl text-center my-8 leading-relaxed">
            Chat with your files using <strong className="text-foreground">intelligent AI</strong>
          </p>
          <p className="text-base text-muted-foreground max-w-xl text-center mb-12">
            Upload your documents and get instant answers. Our AI understands context and provides accurate, relevant responses.
          </p>
          {user ? (
            <div className="flex flex-row gap-4">
              <Link
                href="/files"
                className="bg-primary text-primary-foreground py-3 px-8 rounded-lg text-base font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                Upload Files
              </Link>
              <Link
                href="/chat"
                className="bg-accent text-accent-foreground py-3 px-8 rounded-lg text-base font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                Start Chatting
              </Link>
            </div>
          ) : (
            <div className="flex flex-row gap-4">
              <Link
                href="/login"
                className="bg-secondary text-secondary-foreground border border-border py-3 px-8 rounded-lg text-base font-medium hover:bg-secondary/80 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="bg-primary text-primary-foreground py-3 px-8 rounded-lg text-base font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
        
        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card border border-border">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2">Upload Documents</h3>
            <p className="text-sm text-muted-foreground">
              Support for Markdown and PDF files
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card border border-border">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2">Intelligent Chat</h3>
            <p className="text-sm text-muted-foreground">
              Ask questions and get accurate answers
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card border border-border">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2">Smart Search</h3>
            <p className="text-sm text-muted-foreground">
              Agentic search finds relevant information
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
