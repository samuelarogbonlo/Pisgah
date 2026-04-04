"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT Abuja",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

type DepartmentType = "clinic" | "lab" | "pharmacy";

interface DepartmentConfig {
  type: DepartmentType;
  label: string;
  suffix: string;
  required: boolean;
}

const DEPARTMENT_CONFIGS: DepartmentConfig[] = [
  { type: "clinic", label: "Clinic", suffix: "Clinic", required: true },
  { type: "lab", label: "Laboratory", suffix: "Lab", required: false },
  { type: "pharmacy", label: "Pharmacy", suffix: "Pharmacy", required: false },
];

interface SetupHospitalFormProps {
  dynamicToken: string;
  profile: { email?: string; name?: string };
}

export function SetupHospitalForm({ dynamicToken, profile }: SetupHospitalFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [hospitalName, setHospitalName] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(profile.email ?? "");

  const [enabledDepartments, setEnabledDepartments] = useState<Record<DepartmentType, boolean>>({
    clinic: true,
    lab: false,
    pharmacy: false,
  });

  const [departmentNames, setDepartmentNames] = useState<Record<DepartmentType, string>>({
    clinic: "",
    lab: "",
    pharmacy: "",
  });

  const [userEditedNames, setUserEditedNames] = useState<Record<DepartmentType, boolean>>({
    clinic: false,
    lab: false,
    pharmacy: false,
  });

  useEffect(() => {
    const trimmed = hospitalName.trim();
    setDepartmentNames((prev) => {
      const next = { ...prev };
      for (const config of DEPARTMENT_CONFIGS) {
        if (!userEditedNames[config.type]) {
          next[config.type] = trimmed ? `${trimmed} ${config.suffix}` : "";
        }
      }
      return next;
    });
  }, [hospitalName, userEditedNames]);

  function toggleDepartment(type: DepartmentType) {
    setEnabledDepartments((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
    if (!enabledDepartments[type]) {
      setUserEditedNames((prev) => ({ ...prev, [type]: false }));
    }
  }

  function handleDepartmentNameChange(type: DepartmentType, value: string) {
    setDepartmentNames((prev) => ({ ...prev, [type]: value }));
    setUserEditedNames((prev) => ({ ...prev, [type]: true }));
  }

  function handleSubmit() {
    startTransition(async () => {
      try {
        setError(null);

        if (!hospitalName.trim()) {
          throw new Error("Hospital name is required");
        }
        if (!state) {
          throw new Error("Please select a state");
        }

        const departments = DEPARTMENT_CONFIGS.filter(
          (config) => enabledDepartments[config.type],
        ).map((config) => ({
          name: departmentNames[config.type].trim() || `${hospitalName.trim()} ${config.suffix}`,
          type: config.type,
        }));

        const token = dynamicToken;
        if (!token) {
          throw new Error("Authentication required. Please sign in again.");
        }

        const response = await fetch("/api/provider/setup-hospital", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hospitalName: hospitalName.trim(),
            state,
            lga: lga.trim(),
            address: address.trim(),
            phone: phone.trim(),
            email: email.trim(),
            departments,
          }),
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to set up hospital");
        }

        router.replace("/dashboard");
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Failed to set up hospital");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#161616]">Set up your hospital</p>
        <p className="mt-1 text-sm leading-6 text-[#6d6d6d]">
          Create your hospital profile and departments. You will be the administrator.
        </p>
      </div>

      {/* Hospital details */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#6d6d6d]">Hospital Details</p>

        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
            Hospital / Compound Name *
          </span>
          <input
            value={hospitalName}
            onChange={(e) => setHospitalName(e.target.value)}
            className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
            placeholder="e.g. Grace Medical Centre"
            disabled={isPending}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
            State *
          </span>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
            disabled={isPending}
          >
            <option value="">Select state</option>
            {NIGERIAN_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
            LGA
          </span>
          <input
            value={lga}
            onChange={(e) => setLga(e.target.value)}
            className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
            placeholder="Local Government Area"
            disabled={isPending}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
            Address
          </span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
            placeholder="Street address"
            disabled={isPending}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
            Phone
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
            placeholder="+234..."
            disabled={isPending}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-[#6d6d6d]">
            Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="w-full rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
            placeholder="hospital@example.com"
            disabled={isPending}
          />
        </label>
      </div>

      {/* Departments */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#6d6d6d]">Departments</p>

        {DEPARTMENT_CONFIGS.map((config) => (
          <div key={config.type} className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enabledDepartments[config.type]}
                onChange={() => toggleDepartment(config.type)}
                disabled={config.required || isPending}
                className="accent-black"
              />
              <span className="text-sm text-[#161616]">
                {config.label}
                {config.required && (
                  <span className="ml-1 text-[10px] text-[#6d6d6d]">(required)</span>
                )}
              </span>
            </label>

            {enabledDepartments[config.type] && (
              <input
                value={departmentNames[config.type]}
                onChange={(e) => handleDepartmentNameChange(config.type, e.target.value)}
                className="ml-6 w-[calc(100%-1.5rem)] rounded-[8px] border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                placeholder={`${config.label} name`}
                disabled={isPending}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !hospitalName.trim() || !state}
        className="inline-flex rounded-full border border-black bg-black px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-60"
      >
        {isPending ? "Setting up your hospital... Provisioning ENS identities..." : "Create Hospital"}
      </button>
    </div>
  );
}
