export default function Loading() {
  return (
    <div>
      <div className="mb-4">
        <div className="h-3 w-36 rounded bg-gray-200 animate-pulse" />
        <div className="mt-3 h-12 w-72 rounded bg-gray-200 animate-pulse" />
      </div>
      <div className="mb-5 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-[8px] border border-gray-200 bg-white px-6 py-5">
            <div className="h-9 w-16 rounded bg-gray-100 animate-pulse" />
            <div className="mt-3 h-4 w-24 rounded bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="rounded-[8px] border border-gray-200 bg-white px-8 py-7">
        <div className="mb-5 h-8 w-32 rounded bg-gray-200 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-24 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-100 animate-pulse" />
              <div className="ml-auto h-4 w-24 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
