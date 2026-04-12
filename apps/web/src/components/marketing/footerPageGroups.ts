export type FooterLink = { label: string; href: string }

export const footerPageGroups: Record<string, FooterLink[]> = {
  Product: [
    { label: 'Risk Intelligence', href: '/product/risk-intelligence' },
    { label: 'Carrier Availability', href: '/product/carrier-availability' },
    { label: 'Quote Requests', href: '/product/quote-requests' },
    { label: 'Agent Dashboard', href: '/product/agent-dashboard' },
  ],
  Solutions: [
    { label: 'Home Buyers', href: '/buyers' },
    { label: 'Residential Agents', href: '/agents' },
    { label: 'CRE Brokers', href: '/commercial' },
    { label: 'Lenders', href: '/lenders' },
    { label: 'Insurance Brokers', href: '/insurance' },
  ],
  Company: [
    { label: 'Pricing', href: '/pricing' },
    { label: 'Investors', href: '/investors' },
    { label: 'Careers', href: '/careers' },
  ],
  Resources: [
    { label: 'Help Center', href: '/help' },
    { label: 'Documentation', href: '/docs' },
    { label: 'API Reference', href: '/api-reference' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact', href: '/contact' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security', href: '/security' },
  ],
}
