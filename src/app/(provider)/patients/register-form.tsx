"use client";

import { useTransition, useState, useRef } from "react";
import { registerPatient } from "@/app/actions";
import { Spinner } from "@/components/ui/spinner";

export function RegisterForm() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await registerPatient(formData);
      if (result.success) {
        setMessage("Patient registered successfully");
        formRef.current?.reset();
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage(`Error: ${result.error}`);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit}>
      <div className="grid grid-cols-3 gap-x-6 gap-y-3 max-sm:grid-cols-1">
        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Name
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="Full name"
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
          />
        </div>
        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Phone
          </label>
          <input
            type="text"
            name="phone"
            placeholder="+234..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
          />
        </div>
        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Date of Birth
          </label>
          <input
            type="date"
            name="dob"
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-black bg-black text-white text-xs tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          {isPending ? <><Spinner /> Registering...</> : "Register Patient"}
        </button>
        {message && (
          <div
            className={`rounded-md border p-3 text-sm font-semibold ${
              message.startsWith("Error")
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700 animate-in fade-in duration-300"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </form>
  );
}
