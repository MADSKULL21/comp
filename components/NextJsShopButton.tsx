import type React from "react";
import styles from "./NextJsShopButton.module.css";

function seededIndexes(
  length: number,
  minInclusive: number,
  maxExclusive: number,
  seed: number
) {
  const values: number[] = [];
  let current = seed >>> 0;
  for (let i = 0; i < length; i += 1) {
    current = (current * 1664525 + 1013904223) >>> 0;
    values.push(minInclusive + (current % (maxExclusive - minInclusive)));
  }
  return values;
}

const RIGHT_PIXEL_INDEXES = seededIndexes(25, 0, 4, 1756657616);
const OVERLAY_PIXEL_INDEXES = seededIndexes(11, 4, 8, 1756657617);

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

export type NextJsShopButtonProps = AnchorProps | ButtonProps;

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function ButtonContent({ label }: { label: string }) {
  return (
    <>
      <span className={styles.bg}>
        <span className={styles.bgMid} />
        <span className={styles.bgRight}>
          {RIGHT_PIXEL_INDEXES.map((index, pixelIndex) => (
            <span
              key={`pixel-${pixelIndex}`}
              style={{ "--index": index } as React.CSSProperties}
              className={styles.bgPixel}
            />
          ))}
        </span>
        <span className={styles.bgRightOverlay}>
          {OVERLAY_PIXEL_INDEXES.map((index, pixelIndex) => (
            <span
              key={`overlay-${pixelIndex}`}
              style={{ "--index": index } as React.CSSProperties}
              className={styles.bgPixel}
            />
          ))}
        </span>
      </span>
      <span data-text={label} className={styles.inner}>
        <span className={styles.text}>{label}</span>
      </span>
    </>
  );
}

export default function NextJsShopButton(props: NextJsShopButtonProps) {
  if (props.href) {
    const anchorProps = props as AnchorProps;
    const {
      href,
      label = "Nextjsshop",
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
        <ButtonContent label={label} />
      </a>
    );
  }

  const buttonProps = props as ButtonProps;
  const {
    label = "Nextjsshop",
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
      <ButtonContent label={label} />
    </button>
  );
}
