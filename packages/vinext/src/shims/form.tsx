"use client";

/**
 * next/form shim
 *
 * Progressive enhancement form component. In Next.js, this replaces
 * the standard <form> element with one that intercepts submissions
 * and performs client-side navigation for GET forms (search forms).
 *
 * For POST forms with server actions, it delegates to React's built-in
 * form action handling.
 *
 * Usage:
 *   import Form from 'next/form';
 *   <Form action="/search">
 *     <input name="q" />
 *     <button type="submit">Search</button>
 *   </Form>
 */

import { forwardRef, useActionState, type FormHTMLAttributes, type ForwardedRef } from "react";
import { isDangerousScheme } from "./url-safety.js";
import { appendSearchParamsToUrl } from "../utils/query.js";

// Re-export useActionState from React 19 to match Next.js's next/form module
export { useActionState };

type FormSubmitter = HTMLButtonElement | HTMLInputElement;

function isSafeAction(action: string): boolean {
  // Block dangerous URI schemes
  if (isDangerousScheme(action)) return false;
  // Block protocol-relative URLs (//evil.com/...)
  if (action.startsWith("//")) return false;
  // Block absolute URLs to external origins (client-side: compare origins)
  if (/^https?:\/\//i.test(action)) {
    if (typeof window !== "undefined") {
      try {
        const actionUrl = new URL(action);
        return actionUrl.origin === window.location.origin;
      } catch {
        return false;
      }
    }
    // Server-side: block all absolute URLs (can't compare origins)
    return false;
  }
  return true;
}

function getSubmitter(nativeEvent: unknown): FormSubmitter | null {
  const submitter =
    nativeEvent &&
    typeof nativeEvent === "object" &&
    "submitter" in nativeEvent &&
    nativeEvent.submitter instanceof Element
      ? nativeEvent.submitter
      : null;

  if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
    return submitter;
  }
  return null;
}

function getEffectiveMethod(
  submitter: FormSubmitter | null,
  formMethod: FormHTMLAttributes<HTMLFormElement>["method"],
): string {
  const override = submitter?.getAttribute("formmethod");
  return (override ?? formMethod ?? "GET").toUpperCase();
}

function getEffectiveAction(submitter: FormSubmitter | null, formAction: string): string {
  return submitter?.getAttribute("formaction") ?? formAction;
}

function buildFormData(form: HTMLFormElement, submitter: FormSubmitter | null): FormData {
  if (!submitter) return new FormData(form);

  try {
    return new FormData(form, submitter);
  } catch {
    const formData = new FormData(form);
    if (!submitter.disabled && submitter.name) {
      formData.append(submitter.name, submitter.value);
    }
    return formData;
  }
}

interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  /** Target URL for GET forms, or server action for POST forms */
  action: string | ((formData: FormData) => void | Promise<void>);
  /** Replace instead of push in history (default: false) */
  replace?: boolean;
  /** Scroll to top after navigation (default: true) */
  scroll?: boolean;
}

const Form = forwardRef(function Form(props: FormProps, ref: ForwardedRef<HTMLFormElement>) {
  const { action, replace = false, scroll = true, onSubmit, ...rest } = props;

  // If action is a function (server action), pass it directly to React
  if (typeof action === "function") {
    return <form ref={ref} action={action as any} onSubmit={onSubmit as any} {...rest} />;
  }

  // Block dangerous action URLs. Render <form> without action attribute
  // so it submits to the current page (safe default).
  if (!isSafeAction(action)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`<Form> blocked unsafe action: ${action}`);
    }
    return <form ref={ref} onSubmit={onSubmit as any} {...rest} />;
  }

  async function handleSubmit(e: any) {
    // Call user's onSubmit first
    if (onSubmit) {
      (onSubmit as any)(e);
      if (e.defaultPrevented) return;
    }

    const submitter = getSubmitter(e.nativeEvent);

    // Only intercept GET forms for client-side navigation
    const method = getEffectiveMethod(submitter, rest.method);
    if (method !== "GET") return;

    const effectiveAction = getEffectiveAction(submitter, action as string);
    if (!isSafeAction(effectiveAction)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`<Form> blocked unsafe action: ${effectiveAction}`);
      }
      e.preventDefault();
      return;
    }

    e.preventDefault();

    const formData = buildFormData(e.currentTarget, submitter);
    const params = new URLSearchParams();
    for (const [key, value] of formData) {
      if (typeof value === "string") {
        params.append(key, value);
      }
    }

    const url = appendSearchParamsToUrl(effectiveAction, params);

    // Navigate client-side
    if (typeof window.__VINEXT_RSC_NAVIGATE__ === "function") {
      // App Router: RSC navigation. Await so scroll happens after new content renders.
      if (replace) {
        window.history.replaceState(null, "", url);
      } else {
        window.history.pushState(null, "", url);
      }
      await window.__VINEXT_RSC_NAVIGATE__(url);
    } else {
      // Pages Router: use router or fallback
      if (replace) {
        window.history.replaceState({}, "", url);
      } else {
        window.history.pushState({}, "", url);
      }
      window.dispatchEvent(new PopStateEvent("popstate"));
    }

    if (scroll) {
      window.scrollTo(0, 0);
    }
  }

  return <form ref={ref} action={action} onSubmit={handleSubmit} {...rest} />;
});

export default Form;
