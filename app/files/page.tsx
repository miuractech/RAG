import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import FilesClient from './FilesClient';

export default async function FilesPage() {
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

  const { data: documents } = await supabase
    .from('documents_with_storage_path')
    .select();

  return <FilesClient initialDocuments={documents || []} />;
}
