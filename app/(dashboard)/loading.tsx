export default function DashboardLoading() {
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:flex h-full w-64 flex-col border-r border-gray-200 bg-white animate-pulse">
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6">
          <div className="h-10 w-10 rounded-lg bg-gray-200" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 rounded bg-gray-200" />
            <div className="h-2.5 w-24 rounded bg-gray-200" />
          </div>
        </div>
        <div className="flex-1 space-y-2 px-3 py-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
              <div className="h-5 w-5 rounded bg-gray-200" />
              <div className="h-4 flex-1 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
          <div className="h-6 w-48 rounded bg-gray-200 animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
            <div className="h-8 w-20 rounded bg-gray-200 animate-pulse" />
          </div>
        </div>
        <div className="flex-1 bg-gray-50/50 p-4 sm:p-6 lg:p-8">
          <div className="space-y-4">
            <div className="h-8 w-64 rounded bg-gray-200 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-white border border-gray-200 p-5">
                  <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
                  <div className="mt-3 h-8 w-16 rounded bg-gray-200 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="h-64 rounded-xl bg-white border border-gray-200 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
