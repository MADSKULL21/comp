import type React from "react";
import styles from "./ArrowDotsButton.module.css";

const DOT_INDEXES = [2, 1, 0, 1, 2] as const;
const ICON_INDEXES = [3, 2, 1, 0] as const;

type AnchorProps = {
  href: string;
  label?: string;
  className?: string;
} & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "href" | "className"
>;

type ButtonProps = {
  href?: undefined;
  label?: string;
  className?: string;
} & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className"
>;

export type ArrowDotsButtonProps = AnchorProps | ButtonProps;

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function Dots() {
  return DOT_INDEXES.map((index, dotIndex) => (
    <span
      key={`dot-${dotIndex}`}
      className={styles.dot}
      style={{ "--index": index } as React.CSSProperties}
      aria-hidden="true"
    />
  ));
}

export default function ArrowDotsButton(props: ArrowDotsButtonProps) {
  if (props.href) {
    const anchorProps = props as AnchorProps;
    const {
      label = "Arrow-Dots",
      href,
      className,
      target,
      rel,
      ...rest
    } = anchorProps;
    const resolvedRel = target === "_blank" ? rel || "noopener noreferrer" : rel;

    return (
      <a
        href={href}
        target={target}
        rel={resolvedRel}
        className={mergeClassNames(styles.button, className)}
        {...rest}
      >
        <span className={styles.bg} aria-hidden="true" />
        <span data-text={label} className={styles.inner}>
          <span className={styles.text}>{label}</span>
          <span className={styles.iconWrap} aria-hidden="true">
            {ICON_INDEXES.map((iconIndex, i) => (
              <span
                key={`icon-${i}`}
                className={styles.icon}
                style={{ "--index-parent": iconIndex } as React.CSSProperties}
              >
                <Dots />
              </span>
            ))}
          </span>
        </span>
      </a>
    );
  }

  const buttonProps = props as ButtonProps;
  const {
    label = "Arrow-Dots",
    className,
    type = "button",
    ...rest
  } = buttonProps;

  return (
    <button
      type={type}
      className={mergeClassNames(styles.button, className)}
      {...rest}
    >
      <span className={styles.bg} aria-hidden="true" />
      <span data-text={label} className={styles.inner}>
        <span className={styles.text}>{label}</span>
        <span className={styles.iconWrap} aria-hidden="true">
          {ICON_INDEXES.map((iconIndex, i) => (
            <span
              key={`icon-${i}`}
              className={styles.icon}
              style={{ "--index-parent": iconIndex } as React.CSSProperties}
            >
              <Dots />
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
