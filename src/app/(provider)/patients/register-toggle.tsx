"use client";

import { useState } from "react";
import { RegisterForm } from "./register-form";

export function RegisterToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center px-4 py-2.5 rounded-md border border-black bg-black text-white text-xs tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors"
      >
        {open ? "Cancel" : "+ Register Patient"}
      </button>

      {open && (
        <div className="mt-4 border border-gray-200 rounded-lg bg-white/90 p-4">
          <RegisterForm />
        </div>
      )}
    </div>
  );
}
