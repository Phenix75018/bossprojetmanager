import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Vérifie que chaque correction auto de la page Vérifications échoue
 * proprement (erreur rejetée, message exploitable) quand la base est
 * inaccessible — donc sans jamais bloquer l'interface.
 */

const NETWORK_ERROR = new TypeError("Failed to fetch");

function makeOfflineClient() {
  const builder: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (_res: any, rej: any) => Promise.reject(NETWORK_ERROR).catch(rej);
        }
        return () => builder;
      },
    },
  );
  return { from: () => builder };
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: makeOfflineClient(),
}));

const FINDING_IDS = [
  "dates-no-events",
  "dates-events-after-deadline",
  "dates-overlaps",
  "dates-past-not-done",
  "dates-overload",
  "dates-no-deadline",
  "deps-unknown",
  "deps-self",
  "deps-cycle",
  "deps-backward-phase",
  "deps-p0-blocked",
  "deps-empty-phases",
  "budget-horizon-short",
  "budget-zero-lines",
];

describe("quick fixes hors ligne", () => {
  let getQuickFix: typeof import("@/lib/quickFixes").getQuickFix;

  beforeEach(async () => {
    ({ getQuickFix } = await import("@/lib/quickFixes"));
  });

  it("expose une correction pour chaque incohérence corrigible", () => {
    for (const id of FINDING_IDS) {
      const fix = getQuickFix({ id } as any);
      expect(fix, id).toBeTruthy();
      expect(fix!.label.length, id).toBeGreaterThan(0);
    }
  });

  it("échoue proprement pour chaque bouton sans accès à la base", async () => {
    for (const id of FINDING_IDS) {
      const fix = getQuickFix({ id } as any)!;
      const error = await fix
        .run({ projectId: "00000000-0000-0000-0000-000000000000", userId: "u1" })
        .then(() => null)
        .catch((e) => e);
      expect(error, `${id} devrait rejeter`).toBeInstanceOf(Error);
      // Un message est toujours disponible pour le toast d'erreur de l'UI.
      expect(String((error as Error).message).length, id).toBeGreaterThan(0);
    }
  });
});
