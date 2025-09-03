import Link from 'next/link';
import { Coins } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: 'Features', href: '/features' as const },
      { name: 'Pricing', href: '/pricing' as const },
      { name: 'API', href: '/api' as const },
      { name: 'Documentation', href: '/docs' as const },
    ],
    company: [
      { name: 'About', href: '/about' as const },
      { name: 'Blog', href: '/blog' as const },
      { name: 'Careers', href: '/careers' as const },
      { name: 'Contact', href: '/contact' as const },
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' as const },
      { name: 'Terms of Service', href: '/terms' as const },
      { name: 'Cookie Policy', href: '/cookies' as const },
      { name: 'Disclaimer', href: '/disclaimer' as const },
    ],
  };

  return (
    <footer className="border-t bg-background">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <Coins className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">MemeAnalyzer</span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Comprehensive Web3 application for meme coin analysis and trading insights.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="mb-4 font-semibold">Product</h3>
            <ul className="space-y-2">
              {footerLinks.product.map(link => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map(link => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map(link => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between border-t pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {currentYear} MemeAnalyzer. All rights reserved.
          </p>
          <p className="mt-2 text-sm text-muted-foreground sm:mt-0">
            Built with Next.js and TypeScript
          </p>
        </div>
      </div>
    </footer>
  );
}
