'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavigationLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export default function NavigationLink({ href, children, className }: NavigationLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={cn(
        'nav-link',
        isActive && 'nav-link-active',
        className
      )}
    >
      {children}
    </Link>
  );
}
