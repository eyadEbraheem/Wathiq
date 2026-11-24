import type { MouseEvent } from "react";

/**
 * For forms with several submit buttons (accept / reject, 1–5 stars, ...): the clicked button
 * writes its value into the form's hidden `field` input just before the form is sent.
 * Browsers and React do not reliably pass the pressed button's own name/value to a Server
 * Action, so the buttons carry no `name`; without JavaScript the field stays empty and the
 * action refuses instead of guessing.
 */
export function choose(value: string, field = "decision") {
  return (event: MouseEvent<HTMLButtonElement>) => {
    const input = event.currentTarget.form?.querySelector<HTMLInputElement>(
      `input[type="hidden"][name="${field}"]`,
    );
    if (input) input.value = value;
  };
}
