"use client";

import { useState } from "react";
import styles from "./HamburgerMorphButton.module.css";

export type HamburgerMorphButtonProps = {
  className?: string;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  ariaLabelOpen?: string;
  ariaLabelClose?: string;
};

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function HamburgerMorphButton({
  className,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  ariaLabelOpen = "Open menu",
  ariaLabelClose = "Close menu"
}: HamburgerMorphButtonProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = typeof expanded === "boolean";
  const isExpanded = isControlled ? expanded : internalExpanded;

  const setExpanded = (nextExpanded: boolean) => {
    if (!isControlled) {
      setInternalExpanded(nextExpanded);
    }
    onExpandedChange?.(nextExpanded);
  };

  return (
    <button
      type="button"
      className={mergeClassNames(
        styles.button,
        isExpanded ? styles.expanded : undefined,
        className
      )}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? ariaLabelClose : ariaLabelOpen}
      onClick={() => setExpanded(!isExpanded)}
    >
      <svg
        className={styles.icon}
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M4 12L20 12" className={styles.lineTop} />
        <path d="M4 12H20" className={styles.lineMiddle} />
        <path d="M4 12H20" className={styles.lineBottom} />
      </svg>
    </button>
  );
}
