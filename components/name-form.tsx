"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";

type NameFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  firstName: string;
  lastName: string;
  submitLabel: string;
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-white placeholder:text-white/30 focus:border-amber-300/60 focus:outline-none";

/** First name + last name form, used on both /onboarding and /profile. */
export function NameForm({ action, firstName, lastName, submitLabel }: NameFormProps) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-white/70">
          First name
          <input
            name="first_name"
            defaultValue={firstName}
            required
            maxLength={60}
            autoComplete="given-name"
            className={inputClass}
          />
        </label>
        <label className="text-sm text-white/70">
          Last name
          <input
            name="last_name"
            defaultValue={lastName}
            required
            maxLength={60}
            autoComplete="family-name"
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {state && (
          <p
            role="status"
            className={state.ok ? "text-sm text-emerald-300" : "text-sm text-red-300"}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
