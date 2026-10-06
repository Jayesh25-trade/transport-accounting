"use client";

import { useEffect } from "react";

/**
 * FormKeyboardNavigation
 * Global UX Handler: Replaces default form submission on 'Enter' with
 * logical field-to-field focus navigation across all forms in the application.
 *
 * Rules:
 * 1. ENTER on INPUT or SELECT -> Moves focus to the next visible, enabled form field.
 * 2. ENTER MUST NOT submit/save forms or trigger API writes.
 * 3. TEXTAREA -> Standard newline on ENTER / SHIFT+ENTER.
 * 4. BUTTONS / LINKS -> Standard keyboard accessibility & activation preserved on ENTER.
 * 5. LAST FIELD -> Focus stays on the last field; submission is NEVER triggered automatically.
 */
export function FormKeyboardNavigation() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle 'Enter' key
      if (e.key !== "Enter") return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName.toUpperCase();

      // 1. DO NOT intercept buttons, links, or button-like elements
      if (
        tagName === "BUTTON" ||
        tagName === "A" ||
        target.getAttribute("role") === "button"
      ) {
        return;
      }

      // 2. DO NOT intercept input buttons (submit, button, reset, image)
      if (tagName === "INPUT") {
        const inputType = (target as HTMLInputElement).type.toLowerCase();
        if (["button", "submit", "reset", "image"].includes(inputType)) {
          return;
        }
      }

      // 3. DO NOT intercept textarea (multiline text fields allow standard newlines)
      if (tagName === "TEXTAREA") {
        return;
      }

      // Intercept only form data entry fields: INPUT, SELECT
      if (tagName !== "INPUT" && tagName !== "SELECT") {
        return;
      }

      // Prevent default form submission on Enter!
      e.preventDefault();
      e.stopPropagation();

      // Find closest form container or modal or dialog or fallback to body
      const container =
        target.closest("form") ||
        target.closest('[role="dialog"]') ||
        target.closest(".modal-content") ||
        target.closest(".form-container") ||
        target.closest(".panel") ||
        document.body;

      if (!container) return;

      // Query all candidate focusable elements inside the container in DOM order
      const allElements = Array.from(
        container.querySelectorAll<HTMLElement>(
          "input, select, textarea, [tabindex]"
        )
      );

      // Filter to visible, enabled, editable form controls
      const fields = allElements.filter((el) => {
        // Disabled or readOnly elements are not editable
        if (
          (el as HTMLInputElement).disabled ||
          (el as HTMLInputElement).readOnly
        ) {
          return false;
        }

        // Ignore elements with negative tabindex
        if (el.tabIndex < 0) {
          return false;
        }

        // Must be visible in the DOM layout
        const style = window.getComputedStyle(el);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          return false;
        }

        const tag = el.tagName.toUpperCase();

        // Exclude buttons, submit inputs, links
        if (
          tag === "BUTTON" ||
          tag === "A" ||
          el.getAttribute("role") === "button"
        ) {
          return false;
        }
        if (tag === "INPUT") {
          const type = (el as HTMLInputElement).type.toLowerCase();
          if (
            ["button", "submit", "reset", "image", "hidden", "file"].includes(
              type
            )
          ) {
            return false;
          }
        }

        return true;
      });

      const currentIndex = fields.indexOf(target);

      if (currentIndex !== -1 && currentIndex < fields.length - 1) {
        const nextField = fields[currentIndex + 1];
        nextField.focus();

        // Select text in text/number/search inputs for convenient overwriting
        if (
          nextField.tagName.toUpperCase() === "INPUT" &&
          typeof (nextField as HTMLInputElement).select === "function"
        ) {
          const type = (nextField as HTMLInputElement).type.toLowerCase();
          if (
            ["text", "number", "search", "url", "tel", "password"].includes(
              type
            )
          ) {
            (nextField as HTMLInputElement).select();
          }
        }
      } else if (currentIndex === fields.length - 1) {
        // Last editable field: Prevent submission and keep focus on the field.
        // User must explicitly click Preview/Save/Submit.
      }
    }

    // Attach to document in capture phase (true) so it intercepts Enter before form onSubmit
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return null;
}
