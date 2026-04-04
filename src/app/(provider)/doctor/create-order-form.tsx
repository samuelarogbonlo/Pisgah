"use client";

import { useTransition, useState } from "react";
import { createOrder, createOrderWithNewPatient } from "@/app/actions";
import { Spinner } from "@/components/ui/spinner";

interface Patient {
  id: string;
  name: string;
}

interface CatalogItem {
  testName: string;
  price: string;
}

interface CreateOrderFormProps {
  patients: Patient[];
  catalog: CatalogItem[];
  labName: string;
  labEns: string | null;
}

export function CreateOrderForm({
  patients,
  catalog,
  labName,
  labEns,
}: CreateOrderFormProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [claimLink, setClaimLink] = useState<string | null>(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const firstTest = catalog[0]?.testName ?? "";
  const firstPrice = catalog[0]?.price ?? "0";
  const [selectedTest, setSelectedTest] = useState(firstTest);
  const [amount, setAmount] = useState(firstPrice);

  // If catalog changes (e.g. navigated back after admin added tests), sync
  if (catalog.length > 0 && selectedTest === "" && firstTest !== "") {
    setSelectedTest(firstTest);
    setAmount(firstPrice);
  }

  function handleTestChange(testName: string) {
    setSelectedTest(testName);
    const match = catalog.find((c) => c.testName === testName);
    if (match) {
      setAmount(match.price);
    }
  }

  function handleSubmit(formData: FormData) {
    setMessage(null);
    setClaimLink(null);
    startTransition(async () => {
      const action = isNewPatient ? createOrderWithNewPatient : createOrder;
      const result = await action(formData);
      if (result.error) {
        setMessage(`Error: ${result.error}`);
      } else {
        setMessage(
          "claimEmailSent" in result && result.claimEmailSent
            ? "Order created successfully. Patient link emailed."
            : "Order created successfully",
        );
        setClaimLink("claimLink" in result ? result.claimLink ?? null : null);
        setTimeout(() => setMessage(null), 3000);
      }
    });
  }

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="isNewPatient" value={isNewPatient ? "true" : "false"} />

      {/* Patient toggle */}
      <div className="mb-4">
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setIsNewPatient(false)}
            className={`px-3 py-1.5 transition-colors ${
              !isNewPatient
                ? "bg-black text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Select existing patient
          </button>
          <button
            type="button"
            onClick={() => setIsNewPatient(true)}
            className={`px-3 py-1.5 transition-colors ${
              isNewPatient
                ? "bg-black text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Register new patient
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 max-sm:grid-cols-1">
        {!isNewPatient ? (
          <div>
            <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
              Patient
            </label>
            <select
              name="patientId"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
                Patient Name
              </label>
              <input
                type="text"
                name="patientName"
                required
                placeholder="Full name"
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
                Email
              </label>
              <input
                type="email"
                name="patientEmail"
                placeholder="patient@example.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
                Phone
              </label>
              <input
                type="tel"
                name="patientPhone"
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
                name="patientDob"
                className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Test Type
          </label>
          <select
            name="testType"
            required
            value={selectedTest}
            onChange={(e) => handleTestChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700"
          >
            {catalog.map((c) => (
              <option key={c.testName} value={c.testName}>
                {c.testName}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2 max-sm:col-span-1">
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Clinical Notes
          </label>
          <textarea
            name="clinicalNotes"
            placeholder="Patient presents with..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50/80 text-sm outline-none transition-colors focus:border-gray-700 min-h-[80px] resize-y leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Assign Lab
          </label>
          <input
            className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-100 text-sm text-gray-500 cursor-default"
            value={labName}
            readOnly
          />
          {labEns && (
            <span className="block mt-1.5 font-mono text-xs text-gray-400">
              {labEns}
            </span>
          )}
        </div>

        <div>
          <label className="block text-[11px] tracking-[0.14em] uppercase text-gray-500 mb-2">
            Amount
          </label>
          <div className="flex items-center border border-gray-200 rounded-md bg-gray-100 overflow-hidden">
            <span className="pl-3 pr-1 text-sm text-gray-500 shrink-0">
              &#8358;
            </span>
            <input
              type="number"
              name="amount"
              value={amount}
              readOnly
              className="w-full px-2 py-2 border-none bg-transparent text-sm outline-none text-gray-500 cursor-default"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-black bg-black text-white text-xs tracking-widest uppercase font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          {isPending ? <><Spinner /> Creating...</> : "Create Order"}
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
