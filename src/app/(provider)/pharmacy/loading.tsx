export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
        <div className="mt-3 h-8 w-48 rounded bg-gray-200 animate-pulse" />
      </div>
      <div className="rounded-md border border-gray-200 bg-white">
        <div className="p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-24 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-100 animate-pulse" />
              <div className="ml-auto h-8 w-32 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
