import { Moon, Sun, Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { useColorAnimation } from "@/hooks/useColorAnimation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { colorAnimationEnabled, toggleColorAnimation } = useColorAnimation();

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Basculer le thème"
      >
        <Sun className="w-4 h-4 hidden dark:block" />
        <Moon className="w-4 h-4 block dark:hidden" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Paramètres d'affichage"
          >
            <Settings className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-4">
          <h4 className="font-display font-semibold text-sm mb-3">Affichage</h4>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <span className="text-sm">Animation couleurs</span>
            </div>
            <Switch
              checked={colorAnimationEnabled}
              onCheckedChange={toggleColorAnimation}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
