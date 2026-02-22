import { Project, Phase, Task, SubTask } from "./types";

const generateId = () => Math.random().toString(36).substring(2, 10);

export function generateMockProject(description: string): Project {
  const phases: Phase[] = [
    {
      id: generateId(),
      name: "Phase 1 — Fondation",
      order: 0,
      tasks: [
        createTask("Recherche & Analyse", "Analyser le marché et les besoins", "Phase 1 — Fondation", "P0", 0, [
          "Étude de marché concurrentielle",
          "Définition du persona utilisateur",
          "Analyse des besoins fonctionnels",
        ]),
        createTask("Architecture technique", "Définir la stack et l'architecture", "Phase 1 — Fondation", "P0", 1, [
          "Choix de la stack technologique",
          "Schéma d'architecture système",
          "Modélisation base de données",
        ]),
        createTask("Wireframes & Maquettes", "Créer les maquettes UI/UX", "Phase 1 — Fondation", "P1", 2, [
          "Wireframes basse fidélité",
          "Design system et tokens",
          "Maquettes haute fidélité sur Figma",
          "Prototype interactif",
        ]),
      ],
    },
    {
      id: generateId(),
      name: "Phase 2 — Développement Core",
      order: 1,
      tasks: [
        createTask("Setup projet", "Initialiser le projet et CI/CD", "Phase 2 — Développement Core", "P0", 0, [
          "Initialisation du repo Git",
          "Configuration CI/CD",
          "Setup environnement dev",
        ]),
        createTask("Fonctionnalités principales", "Développer les features core", "Phase 2 — Développement Core", "P0", 1, [
          "Authentification utilisateur",
          "CRUD principal",
          "Intégration API",
          "Tests unitaires",
        ]),
        createTask("Interface utilisateur", "Implémenter le frontend", "Phase 2 — Développement Core", "P1", 2, [
          "Composants réutilisables",
          "Pages principales",
          "Responsive design",
        ]),
      ],
    },
    {
      id: generateId(),
      name: "Phase 3 — Polish & Lancement",
      order: 2,
      tasks: [
        createTask("Tests & QA", "Tester et corriger les bugs", "Phase 3 — Polish & Lancement", "P1", 0, [
          "Tests d'intégration",
          "Tests end-to-end",
          "Correction des bugs critiques",
        ]),
        createTask("Optimisation", "Optimiser les performances", "Phase 3 — Polish & Lancement", "P2", 1, [
          "Audit de performance",
          "Optimisation des images et assets",
          "SEO technique",
        ]),
        createTask("Lancement", "Déployer et lancer", "Phase 3 — Polish & Lancement", "P0", 2, [
          "Déploiement production",
          "Monitoring et alertes",
          "Communication de lancement",
        ]),
      ],
    },
  ];

  return {
    id: generateId(),
    title: extractTitle(description),
    description,
    status: "planning",
    availability: {
      daysPerWeek: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"],
      hoursPerWeek: 20,
      timeSlots: "9h-12h, 14h-18h",
    },
    phases,
    createdAt: new Date().toISOString(),
    completionPercent: 0,
  };
}

function createTask(
  title: string,
  description: string,
  phase: string,
  priority: "P0" | "P1" | "P2",
  order: number,
  subtaskTitles: string[]
): Task {
  return {
    id: generateId(),
    title,
    description,
    phase,
    priority,
    status: "todo",
    duration: Math.floor(Math.random() * 16) + 4,
    subtasks: subtaskTitles.map((st, i) => ({
      id: generateId(),
      title: st,
      status: "todo",
      duration: Math.floor(Math.random() * 4) + 1,
    })),
    dependencies: [],
    tags: [],
    order,
  };
}

function extractTitle(description: string): string {
  const words = description.split(" ").slice(0, 5).join(" ");
  return words.length > 40 ? words.substring(0, 40) + "…" : words;
}

export const demoProjects: Project[] = [
  generateMockProject("Application mobile de livraison de repas avec suivi GPS en temps réel"),
  generateMockProject("Plateforme e-commerce B2B pour fournisseurs industriels"),
];
