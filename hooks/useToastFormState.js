"use client";

import { useFormState } from "react-dom";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ToastProvider";

// Drop-in replacement for useFormState that also fires a toast whenever
// the action resolves with an error or a success — this is what makes
// every save/approve/upload/etc. across the app feel like something
// actually happened, instead of a static inline message easy to miss.
// successMessage can be a string or a function (state) => string, for
// cases like "Approved 3 requisitions" that depend on the result.
export function useToastFormState(action, initialState, successMessage = "Saved.") {
  const [state, formAction] = useFormState(action, initialState);
  const { showToast } = useToast();
  const prevStateRef = useRef(initialState);

  useEffect(() => {
    if (state === prevStateRef.current) return; // skip initial mount
    prevStateRef.current = state;

    if (state?.error) {
      showToast({ message: state.error, type: "error" });
    } else if (state?.success) {
      const message = typeof successMessage === "function" ? successMessage(state) : successMessage;
      showToast({ message, type: "success" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return [state, formAction];
}
