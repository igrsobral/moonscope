import Link from 'next/link';
import { Coins, Github, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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

  const socialLinks = [
    { name: 'Twitter', href: 'https://twitter.com', icon: Twitter },
    { name: 'GitHub', href: 'https://github.com', icon: Github },
  ];

  return (
    <footer className="border-t bg-background">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
          {/* Brand */}
          <div className="space-y-4 md:col-span-2">
            <Link href="/" className="flex items-center space-x-2">
              <Coins className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">MemeAnalyzer</span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Comprehensive Web3 application for meme coin analysis and trading insights. Make
              informed decisions with real-time data and advanced analytics.
            </p>

            {/* Social Links */}
            <div className="flex space-x-2">
              {socialLinks.map(social => {
                const Icon = social.icon;
                return (
                  <Button key={social.name} variant="ghost" size="icon" asChild className="h-8 w-8">
                    <Link href={social.href} target="_blank" rel="noopener noreferrer">
                      <Icon className="h-4 w-4" />
                      <span className="sr-only">{social.name}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
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

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between space-y-4 sm:flex-row sm:space-y-0">
          <div className="flex flex-col items-center space-y-2 sm:flex-row sm:space-x-4 sm:space-y-0">
            <p className="text-sm text-muted-foreground">
              © {currentYear} MemeAnalyzer. All rights reserved.
            </p>
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <span>Built with</span>
              <span className="text-red-500">♥</span>
              <span>using Next.js and TypeScript</span>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
              <span>All systems operational</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
