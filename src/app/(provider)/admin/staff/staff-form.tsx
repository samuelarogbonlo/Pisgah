"use client";

import { useState, useTransition } from "react";
import { inviteStaff } from "@/app/actions";
import { Spinner } from "@/components/ui/spinner";

export function InviteStaffForm({
  facilities,
}: {
  facilities: Array<{ id: string; label: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<{
    message: string;
    inviteLink: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAction(formData: FormData) {
    startTransition(async () => {
      setSuccess(null);
      setError(null);

      const result = await inviteStaff(formData);
      if (!result.success) {
        setError(result.error ?? "Unable to create invite");
        return;
      }

      setSuccess({
        message: "Invite sent! The staff member will receive an email with their invite link.",
        inviteLink: "inviteLink" in result ? result.inviteLink ?? null : null,
      });
    });
  }

  return (
    <form action={handleAction} className="mt-5 space-y-4">
      <label className="block">
        <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-gray-500">
          Name
        </span>
        <input
          name="name"
          required
          className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
          placeholder="Dr. Adeyemi"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-gray-500">
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
          placeholder="doctor@stlukes.ng"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-gray-500">
            Role
          </span>
          <select
            name="role"
            required
            className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
            defaultValue=""
          >
            <option value="" disabled>
              Select role
            </option>
            <option value="doctor">Doctor</option>
            <option value="accounts">Accounts</option>
            <option value="lab_tech">Lab Tech</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="rider">Rider</option>
          </select>
          <p className="mt-2 text-xs text-gray-500">
            Hospital admins are promoted after the staff account has been activated.
          </p>
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-gray-500">
            Assigned Facility
          </span>
          <select
            name="facilityId"
            required
            className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
            defaultValue=""
          >
            <option value="" disabled>
              Select facility
            </option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full border border-black bg-black px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-60"
      >
        {isPending ? <><Spinner /> Sending...</> : "Send Invite"}
      </button>

      {success && (
        <div className="rounded-[8px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <p>{success.message}</p>
        </div>
      )}

      {error && (
        <p className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
