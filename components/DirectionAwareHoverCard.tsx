"use client";

import type React from "react";
import { useRef, useState } from "react";
import styles from "./DirectionAwareHoverCard.module.css";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1663765970236-f2acfde22237?q=80&w=3542&auto=format&fit=crop";

type Direction = "top" | "right" | "bottom" | "left";

export type DirectionAwareHoverCardProps =
  React.HTMLAttributes<HTMLDivElement> & {
    imageUrl?: string;
    alt?: string;
    title?: string;
    subtitle?: string;
  };

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function getHoverDirection(
  event: React.MouseEvent<HTMLDivElement>,
  element: HTMLDivElement
) {
  const { width, height, left, top } = element.getBoundingClientRect();
  const x =
    event.clientX - left - (width / 2) * (width > height ? height / width : 1);
  const y =
    event.clientY - top - (height / 2) * (height > width ? width / height : 1);

  return Math.round(Math.atan2(y, x) / 1.57079633 + 5) % 4;
}

function mapDirection(directionIndex: number): Direction {
  switch (directionIndex) {
    case 0:
      return "top";
    case 1:
      return "right";
    case 2:
      return "bottom";
    case 3:
      return "left";
    default:
      return "left";
  }
}

export default function DirectionAwareHoverCard({
  imageUrl = DEFAULT_IMAGE,
  alt = "image",
  title = "In the mountains",
  subtitle = "$1299 / night",
  className,
  children,
  ...rest
}: DirectionAwareHoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<Direction>("left");

  const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const directionIndex = getHoverDirection(event, cardRef.current);
    setDirection(mapDirection(directionIndex));
  };

  const directionClass = styles[direction] || styles.left;

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      className={mergeClassNames(styles.card, directionClass, className)}
      {...rest}
    >
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.imageLayer}>
        <img src={imageUrl} alt={alt} className={styles.image} />
      </div>
      <div className={styles.content}>
        {children || (
          <>
            <p className={styles.title}>{title}</p>
            <p className={styles.subtitle}>{subtitle}</p>
          </>
        )}
      </div>
    </div>
  );
}
