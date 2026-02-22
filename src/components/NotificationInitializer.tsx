import { useNotifications } from "@/hooks/useNotifications";

export function NotificationInitializer() {
  // Just mounting this hook starts the notification check loop
  useNotifications();
  return null;
}
