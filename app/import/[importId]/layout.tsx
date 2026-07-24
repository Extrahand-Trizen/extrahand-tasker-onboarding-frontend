/** Required for `output: 'export'` with dynamic segments. */
export function generateStaticParams() {
  return [{ importId: "_" }];
}

export default function ImportIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
