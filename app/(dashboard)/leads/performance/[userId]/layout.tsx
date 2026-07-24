/** Required for `output: 'export'` with dynamic segments. */
export function generateStaticParams() {
  return [{ userId: "_" }];
}

export default function PerformanceUserLayout({ children }: { children: React.ReactNode }) {
  return children;
}
