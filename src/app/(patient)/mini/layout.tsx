import { MiniProviders } from "./providers";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MiniProviders>
      <div className="min-h-screen bg-[#f3f3f1] px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-[420px] rounded-[32px] border border-black/10 bg-[#111] p-3 shadow-xl">
          <div className="mx-auto mb-4 h-[5px] w-28 rounded-full bg-white/20" />
          <div className="overflow-hidden rounded-[26px] bg-white">
            {children}
          </div>
        </div>
      </div>
    </MiniProviders>
  );
}
