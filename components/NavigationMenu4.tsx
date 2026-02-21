"use client";

import { useState } from "react";
import HamburgerMorphButton from "./HamburgerMorphButton";
import styles from "./NavigationMenu4.module.css";

type IconName = "BookOpenIcon" | "LifeBuoyIcon" | "InfoIcon";
type MenuType = "description" | "simple" | "icon";

type BaseItem = {
  href: string;
  label: string;
};

type DescriptionItem = BaseItem & {
  description: string;
};

type IconItem = BaseItem & {
  icon: IconName;
};

type MenuSection =
  | { href: string; label: string; submenu: false }
  | {
      label: string;
      submenu: true;
      type: MenuType;
      items: Array<BaseItem | DescriptionItem | IconItem>;
    };

const MENU: MenuSection[] = [
  { href: "#", label: "Home", submenu: false },
  {
    label: "Features",
    submenu: true,
    type: "description",
    items: [
      {
        href: "#",
        label: "Components",
        description: "Browse all components in the library."
      },
      {
        href: "#",
        label: "Documentation",
        description: "Learn how to use the library."
      },
      {
        href: "#",
        label: "Templates",
        description: "Pre-built layouts for common use cases."
      }
    ]
  },
  {
    label: "Pricing",
    submenu: true,
    type: "simple",
    items: [
      { href: "#", label: "Product A" },
      { href: "#", label: "Product B" },
      { href: "#", label: "Product C" },
      { href: "#", label: "Product D" }
    ]
  },
  {
    label: "About",
    submenu: true,
    type: "icon",
    items: [
      { href: "#", label: "Getting Started", icon: "BookOpenIcon" },
      { href: "#", label: "Tutorials", icon: "LifeBuoyIcon" },
      { href: "#", label: "About Us", icon: "InfoIcon" }
    ]
  }
];

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function shouldShowDivider(current: MenuSection, next?: MenuSection) {
  if (!next) return false;
  if (!current.submenu && next.submenu) return true;
  if (current.submenu && !next.submenu) return true;
  if (current.submenu && next.submenu && current.type !== next.type) return true;
  return false;
}

function MenuIcon({ icon }: { icon: IconName }) {
  if (icon === "BookOpenIcon") {
    return (
      <svg viewBox="0 0 24 24" className={styles.itemIcon} aria-hidden="true">
        <path d="M4 5.5C4 4.12 5.12 3 6.5 3H11v18H6.5A2.5 2.5 0 0 1 4 18.5V5.5Z" />
        <path d="M20 5.5C20 4.12 18.88 3 17.5 3H13v18h4.5a2.5 2.5 0 0 0 2.5-2.5V5.5Z" />
      </svg>
    );
  }
  if (icon === "LifeBuoyIcon") {
    return (
      <svg viewBox="0 0 24 24" className={styles.itemIcon} aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={styles.itemIcon} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7h.01" />
    </svg>
  );
}

function DesktopDropdown({
  item,
  isOpen
}: {
  item: Extract<MenuSection, { submenu: true }>;
  isOpen: boolean;
}) {
  return (
    <div
      className={mergeClassNames(styles.dropdown, isOpen ? styles.dropdownOpen : undefined)}
    >
      <ul
        className={mergeClassNames(
          styles.dropdownGrid,
          item.type === "description" ? styles.dropdownOneColumn : styles.dropdownTwoColumn
        )}
      >
        {item.items.map((entry) => (
          <li key={entry.label}>
            <a href={entry.href} className={styles.dropdownLink}>
              {item.type === "icon" && "icon" in entry ? (
                <div className={styles.iconRow}>
                  <MenuIcon icon={entry.icon} />
                  <span className={styles.dropdownTitle}>{entry.label}</span>
                </div>
              ) : null}
              {item.type === "description" && "description" in entry ? (
                <>
                  <div className={styles.dropdownTitle}>{entry.label}</div>
                  <p className={styles.dropdownDescription}>{entry.description}</p>
                </>
              ) : null}
              {item.type === "simple" ? (
                <div className={styles.dropdownTitle}>{entry.label}</div>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function NavigationMenu4() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDesktopSubmenu, setOpenDesktopSubmenu] = useState<string | null>(null);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <div className={styles.mobileOnly}>
            <div className={styles.mobileMenuWrap}>
              <HamburgerMorphButton
                expanded={mobileOpen}
                onExpandedChange={setMobileOpen}
                className={styles.mobileTrigger}
              />
              {mobileOpen ? (
                <div className={styles.mobilePanel}>
                  <nav className={styles.mobileNav}>
                    {MENU.map((entry, index) => (
                      <div key={entry.label} className={styles.mobileGroup}>
                        {entry.submenu ? (
                          <>
                            <div className={styles.mobileHeading}>{entry.label}</div>
                            <ul className={styles.mobileList}>
                              {entry.items.map((subItem) => (
                                <li key={subItem.label}>
                                  <a href={subItem.href} className={styles.mobileLink}>
                                    {subItem.label}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : "href" in entry ? (
                          <a href={entry.href} className={styles.mobileLink}>
                            {entry.label}
                          </a>
                        ) : null}
                        {shouldShowDivider(entry, MENU[index + 1]) ? (
                          <div className={styles.mobileDivider} role="separator" />
                        ) : null}
                      </div>
                    ))}
                  </nav>
                </div>
              ) : null}
            </div>
          </div>
          <div className={styles.brandAndDesktopNav}>
            <a href="#" className={styles.logo}>
              Logo
            </a>
            <nav className={styles.desktopNav}>
              <ul className={styles.desktopList}>
                {MENU.map((entry) => (
                  <li
                    key={entry.label}
                    className={styles.desktopItem}
                    onMouseEnter={() => {
                      if (entry.submenu) setOpenDesktopSubmenu(entry.label);
                    }}
                    onMouseLeave={() => {
                      if (entry.submenu) setOpenDesktopSubmenu((current) =>
                        current === entry.label ? null : current
                      );
                    }}
                  >
                    {entry.submenu ? (
                      <>
                        <button
                          type="button"
                          className={styles.desktopTrigger}
                          onClick={() =>
                            setOpenDesktopSubmenu((current) =>
                              current === entry.label ? null : entry.label
                            )
                          }
                        >
                          {entry.label}
                        </button>
                        <DesktopDropdown
                          item={entry}
                          isOpen={openDesktopSubmenu === entry.label}
                        />
                      </>
                    ) : "href" in entry ? (
                      <a href={entry.href} className={styles.desktopLink}>
                        {entry.label}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className={styles.navIndicator} />
            </nav>
          </div>
        </div>
        <div className={styles.rightActions}>
          <a href="#" className={styles.signIn}>
            Sign In
          </a>
          <a href="#" className={styles.getStarted}>
            Get Started
          </a>
        </div>
      </div>
    </header>
  );
}
