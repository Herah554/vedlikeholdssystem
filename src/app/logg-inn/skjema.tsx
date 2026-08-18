"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, LogIn } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { loggInn, type LoginState } from "./actions";

function SendKnapp() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <LogIn className="size-4" aria-hidden />
      {pending ? "Logger inn …" : "Logg inn"}
    </Button>
  );
}

export function LoginSkjema() {
  const [state, action] = useActionState<LoginState, FormData>(loggInn, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-500/15 px-3 py-2.5 text-sm text-red-800 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-500/30 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <Field label="E-post" required>
        <Input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="navn@firma.no"
        />
      </Field>

      <Field label="Passord" required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      <SendKnapp />
    </form>
  );
}
