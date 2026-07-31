import * as React from "react";

/**
 * Radix emite avisos na consola quando um Dialog/AlertDialog/Sheet não tem
 * `Title` ou `Description`. Estes helpers percorrem os children para detetar
 * se já existem e permitem injetar equivalentes sr-only (sem alterar o layout).
 */
function matchesRole(type: any, role: "title" | "description"): boolean {
  if (!type) return false;
  const name: string =
    (typeof type === "string" && type) ||
    type.displayName ||
    type.name ||
    "";
  return name.toLowerCase().includes(role);
}

function scan(children: React.ReactNode, role: "title" | "description"): boolean {
  let found = false;
  React.Children.forEach(children, (child) => {
    if (found || !React.isValidElement(child)) return;
    if (matchesRole(child.type, role)) {
      found = true;
      return;
    }
    const nested = (child.props as any)?.children;
    if (nested && scan(nested, role)) found = true;
  });
  return found;
}

/** Deteta se os children já contêm um Title / Description do Radix. */
export function useDialogA11y(children: React.ReactNode) {
  const hasTitle = React.useMemo(() => scan(children, "title"), [children]);
  const hasDescription = React.useMemo(() => scan(children, "description"), [children]);
  return { hasTitle, hasDescription };
}

export const srOnlyClass = "sr-only";
