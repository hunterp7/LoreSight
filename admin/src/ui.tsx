import type { ComponentProps, ReactNode } from "react";
import {
  Badge,
  Button,
  Input,
  Select,
  ThemeProvider,
  Window,
  defaultTheme,
} from "retro-react";

export function StoryframeTheme({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>;
}

export function AdminPanel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Window title={title} draggable={false} closable={false} className={`admin-panel ${className}`}>
      {children}
    </Window>
  );
}

export function StoryButton(props: ComponentProps<typeof Button>) {
  return <Button disableClickEffect {...props} />;
}

export function StoryInput(props: ComponentProps<typeof Input>) {
  return <Input variant="classic" {...props} />;
}

export function StorySelect(props: ComponentProps<typeof Select>) {
  return <Select variant="classic" {...props} />;
}

export function StatusBadge({ label, tone = "primary" }: { label: string; tone?: "primary" | "success" | "error" | "warning" }) {
  return <Badge badgeContent={label} color={tone === "warning" ? "warn" : tone} showZero><span className="badge-anchor" /></Badge>;
}
