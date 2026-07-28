/** Required for `output: 'export'` with dynamic segments. */
export function generateStaticParams() {
  return [{ leadId: "_" }];
}

export default function LeadIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
