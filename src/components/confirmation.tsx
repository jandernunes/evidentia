"use client";
import { useEffect, useId, useRef, useState } from "react";

export function useConfirmation() {
  const [message, setMessage] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const messageId = useId();
  useEffect(() => {
    if (message) {
      dialog.current?.showModal();
      cancel.current?.focus();
    } else if (dialog.current?.open) dialog.current.close();
  }, [message]);
  useEffect(
    () => () => {
      resolver.current?.(false);
    },
    [],
  );
  function finish(accepted: boolean) {
    const resolve = resolver.current;
    resolver.current = null;
    setMessage(null);
    resolve?.(accepted);
    requestAnimationFrame(() => {
      if (trigger.current?.isConnected) trigger.current.focus();
    });
  }
  function confirm(message: string) {
    if (resolver.current) return Promise.resolve(false);
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMessage(message);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }
  const confirmation = (
    <dialog
      ref={dialog}
      className="confirmation"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        finish(false);
      }}
      onClose={() => {
        if (resolver.current) finish(false);
      }}
    >
      <h2 id={titleId}>Confirmar ação</h2>
      <p id={messageId}>{message}</p>
      <div className="inline-actions">
        <button
          ref={cancel}
          type="button"
          className="button secondary"
          onClick={() => finish(false)}
        >
          Cancelar
        </button>
        <button type="button" className="button" onClick={() => finish(true)}>
          Confirmar
        </button>
      </div>
    </dialog>
  );
  return { confirm, confirmation };
}
