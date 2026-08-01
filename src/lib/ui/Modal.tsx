import { useEffect, useRef, type ReactNode } from "react";
import { T, lift } from "../theme";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  /** Rendered inline instead of over an overlay — for docking the console in a page. */
  inline?: boolean;
  maxWidth?: number;
}

/**
 * Dialog shell: overlay click and Escape close it, focus moves in on open and
 * back to whatever had it on close, and Tab is kept inside while it is open.
 */
export function Modal(props: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!props.open || props.inline) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => restoreTo.current?.focus?.();
  }, [props.open, props.inline]);

  useEffect(() => {
    if (!props.open || props.inline) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        props.onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog.current) return;

      const focusable = dialog.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [props.open, props.inline, props.onClose]);

  if (!props.open) return null;

  const panel = (
    <div
      ref={dialog}
      role="dialog"
      aria-modal={props.inline ? undefined : true}
      aria-label={props.label}
      tabIndex={-1}
      className={props.inline ? "amb-root" : "amb-root amb-dialog"}
      style={{
        display: "flex",
        width: "100%",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 24,
        maxWidth: props.maxWidth ?? 780,
        maxHeight: props.inline ? undefined : "88vh",
        background: T.surface,
        boxShadow: lift,
        fontFamily: T.font,
        outline: "none",
        animation: props.inline ? undefined : "amb-rise .22s cubic-bezier(.4,0,.2,1)",
      }}
    >
      {props.children}
    </div>
  );

  if (props.inline) return panel;

  return (
    <div
      className="amb-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(24,24,28,.32)",
        animation: "amb-fade-in .18s ease",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      {panel}
    </div>
  );
}
