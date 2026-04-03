export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-start justify-center py-8">
      <div className="w-[390px] min-h-[700px] border border-gray-200 rounded-[32px] overflow-hidden bg-white shadow-sm">
        <div className="px-5 py-3 border-b border-gray-200 text-center">
          <h2 className="text-[17px] font-bold tracking-tight">Pisgah</h2>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
