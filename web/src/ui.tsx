import type { ComponentProps, ReactNode } from "react";
import { Button, Marquee, ThemeProvider, defaultTheme } from "retro-react";

export function PlayerTheme({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>;
}

export function StoryButton(props: ComponentProps<typeof Button>) {
  return <Button disableClickEffect variant="outline" {...props} />;
}

export function StoryMarquee(props: ComponentProps<typeof Marquee>) {
  return <Marquee {...props} />;
}
