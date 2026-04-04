export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
        <div className="mt-3 h-8 w-56 rounded bg-gray-200 animate-pulse" />
        <div className="mt-2 h-4 w-32 rounded bg-gray-100 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
        <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
          <div className="h-3 w-20 rounded bg-gray-100 animate-pulse" />
          <div className="h-24 w-full rounded bg-gray-100 animate-pulse" />
          <div className="h-3 w-28 rounded bg-gray-100 animate-pulse" />
          <div className="h-16 w-full rounded bg-gray-100 animate-pulse" />
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-4 space-y-3">
          <div className="h-3 w-32 rounded bg-gray-100 animate-pulse" />
          <div className="h-20 w-full rounded bg-gray-100 animate-pulse" />
          <div className="h-3 w-28 rounded bg-gray-100 animate-pulse" />
          <div className="h-16 w-full rounded bg-gray-100 animate-pulse" />
          <div className="h-10 w-40 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
