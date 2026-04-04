"use client";

import { useState } from "react";
import { promoteToAdmin } from "@/app/actions";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  email: string | null;
  isActive: boolean;
  facilityName: string;
}

export function SettingsClient({
  staff,
  currentUserId,
}: {
  staff: StaffMember[];
  currentUserId: string;
}) {
  const [promoting, setPromoting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePromote(userId: string, userName: string) {
    if (
      !confirm(
        `Grant hospital admin privileges to ${userName}? This affects access across the hospital network.`,
      )
    ) {
      return;
    }

    setPromoting(userId);
    setError(null);

    try {
      const result = await promoteToAdmin(userId);
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      setError("Failed to promote user");
    } finally {
      setPromoting(null);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {staff.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-md border border-[#d8d8d2] px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold">{s.name}</p>
            <p className="mt-0.5 text-xs text-[#6d6d6d]">
              {s.email || "No email"} &middot; {s.role.replace("_", " ")} &middot;{" "}
              {s.facilityName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${
                s.isActive
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {s.isActive ? "Active" : "Inactive"}
            </span>
            {s.role === "admin" && (
              <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#6d6d6d]">
                Hospital admin
              </span>
            )}
            {s.role !== "admin" && s.id !== currentUserId && (
              <button
                type="button"
                onClick={() => handlePromote(s.id, s.name)}
                disabled={promoting === s.id}
                className="rounded-full border border-black bg-black px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {promoting === s.id ? "Promoting..." : "Grant Hospital Admin"}
              </button>
            )}
          </div>
        </div>
      ))}
      {staff.length === 0 && (
        <p className="py-4 text-center text-sm text-[#6d6d6d]">
          No hospital staff members linked yet
        </p>
      )}
    </div>
  );
}
