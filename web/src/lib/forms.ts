import { startTransition, type FormEvent } from "react";

/**
 * `onSubmit` for a form driven by `useActionState`. React 19 empties a form after every
 * `action={...}` submit, even when the action comes back with an error, so the user would have
 * to type everything again. This sends the same FormData (with the clicked submit button) without
 * that reset. Keep `action={...}` on the form too: it still works when JavaScript is off.
 * A form that should clear after success resets itself (see CommentForm).
 */
export function keepValuesOnSubmit(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => action(formData));
  };
}
