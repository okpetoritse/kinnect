"use client";

import { useEffect, useRef, useState } from "react";
import { updateCountry } from "./actions";
import { ChevronDown } from "lucide-react";
import styles from "./page.module.css";

const COUNTRIES = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "Egypt",
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "France",
  "India",
  "United Arab Emirates",
  "Other",
];

export default function CountryPicker({
  initialCountry,
}: {
  initialCountry: string | null;
}) {
  const [country, setCountry] = useState(initialCountry || "");
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleChange(value: string) {
    setCountry(value);
    setOpen(false);

    await updateCountry(value);

    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className={styles.countrySection}>
      <div className={styles.usernameLabel}>Your country</div>

      <div className={styles.countrySelectWrap} ref={dropdownRef}>
        <button
          type="button"
          className={`${styles.countrySelect} ${
            open ? styles.countrySelectOpen : ""
          }`}
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={!country ? styles.countryPlaceholder : ""}>
            {country || "Select your country"}
          </span>

          <ChevronDown
            size={16}
            className={`${styles.countrySelectArrow} ${
              open ? styles.countrySelectArrowOpen : ""
            }`}
          />
        </button>

        {open && (
          <div className={styles.countryMenu} role="listbox">
            <button
              type="button"
              className={`${styles.countryOption} ${
                !country ? styles.countryOptionSelected : ""
              }`}
              onClick={() => handleChange("")}
              role="option"
              aria-selected={!country}
            >
              Select your country
            </button>

            {COUNTRIES.map((c) => (
              <button
                type="button"
                key={c}
                className={`${styles.countryOption} ${
                  country === c ? styles.countryOptionSelected : ""
                }`}
                onClick={() => handleChange(c)}
                role="option"
                aria-selected={country === c}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {saved && (
        <div
          className={styles.usernameStatus}
          style={{ color: "var(--teal)" }}
        >
          Saved
        </div>
      )}
    </div>
  );
}