import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { MoonIcon, SunIcon } from "../icons.ts";
import { useColorScheme } from "../theme/ColorSchemeContext.tsx";

export function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const handleToggle = () => {
    setColorScheme(isDark ? "light" : "dark");
  };

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <IconButton
      label={label}
      tooltip={label}
      variant="ghost"
      icon={<Icon icon={isDark ? SunIcon : MoonIcon} size="sm" />}
      onClick={handleToggle}
    />
  );
}
