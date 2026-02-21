import type React from "react";
import styles from "./AnimatedArrowButton.module.css";

const FIRST_ICON_DOT_INDEXES = [
  0, 2, 2, 1, 2, 0, 1, 1, 2, 2, 0, 1, 0, 2, 2, 1, 0, 2, 2, 2, 2, 0, 1, 0, 2
] as const;
const ARROW_DOT_INDEXES = [0, 2, 2, 1, 2, 0, 1, 1, 2] as const;
type ArrowVariant = "default" | "tilted45";

type AnchorProps = {
  href: string;
  text?: string;
  arrowVariant?: ArrowVariant;
  className?: string;
} & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "href" | "className"
>;

type ButtonProps = {
  href?: undefined;
  text?: string;
  arrowVariant?: ArrowVariant;
  className?: string;
} & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className"
>;

export type AnimatedArrowButtonProps = AnchorProps | ButtonProps;

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export default function AnimatedArrowButton(props: AnimatedArrowButtonProps) {
  if (props.href) {
    const anchorProps = props as AnchorProps;
    const {
      href,
      text = "Nothing-Plop",
      arrowVariant = "default",
      className,
      target,
      rel,
      ...rest
    } = anchorProps;
    const resolvedRel = target === "_blank" ? rel || "noopener noreferrer" : rel;
    const arrowClass =
      arrowVariant === "tilted45" ? styles.iconArrowTilted45 : styles.iconArrow;

    return (
      <a
        href={href}
        target={target}
        rel={resolvedRel}
        className={mergeClassNames(styles.button, className)}
        {...rest}
      >
        <span className={styles.bg} />
        <span data-text={text} className={styles.inner}>
          <span className={styles.text}>{text}</span>
          <span className={styles.iconWrap}>
            <span
              className={styles.icon}
              style={{ "--index-parent": 0 } as React.CSSProperties}
            >
              {FIRST_ICON_DOT_INDEXES.map((index, dotIndex) => (
                <span
                  key={`first-dot-${dotIndex}`}
                  style={{ "--index": index } as React.CSSProperties}
                  className={styles.dot}
                />
              ))}
            </span>
            <span
              className={mergeClassNames(styles.icon, arrowClass)}
              style={{ "--index-parent": 1 } as React.CSSProperties}
            >
              {ARROW_DOT_INDEXES.map((index, dotIndex) => (
                <span
                  key={`arrow-dot-${dotIndex}`}
                  style={{ "--index": index } as React.CSSProperties}
                  className={styles.dot}
                />
              ))}
            </span>
          </span>
        </span>
      </a>
    );
  }

  const buttonProps = props as ButtonProps;
  const {
    text = "Nothing-Plop",
    arrowVariant = "default",
    className,
    type = "button",
    ...rest
  } = buttonProps;
  const arrowClass =
    arrowVariant === "tilted45" ? styles.iconArrowTilted45 : styles.iconArrow;

  return (
    <button
      type={type}
      className={mergeClassNames(styles.button, className)}
      {...rest}
    >
      <span className={styles.bg} />
      <span data-text={text} className={styles.inner}>
        <span className={styles.text}>{text}</span>
        <span className={styles.iconWrap}>
          <span
            className={styles.icon}
            style={{ "--index-parent": 0 } as React.CSSProperties}
          >
            {FIRST_ICON_DOT_INDEXES.map((index, dotIndex) => (
              <span
                key={`first-dot-${dotIndex}`}
                style={{ "--index": index } as React.CSSProperties}
                className={styles.dot}
              />
            ))}
          </span>
          <span
            className={mergeClassNames(styles.icon, arrowClass)}
            style={{ "--index-parent": 1 } as React.CSSProperties}
          >
            {ARROW_DOT_INDEXES.map((index, dotIndex) => (
              <span
                key={`arrow-dot-${dotIndex}`}
                style={{ "--index": index } as React.CSSProperties}
                className={styles.dot}
              />
            ))}
          </span>
        </span>
      </span>
    </button>
  );
}
