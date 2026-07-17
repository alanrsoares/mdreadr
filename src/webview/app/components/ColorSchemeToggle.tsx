import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { ComputerDesktopIcon, MoonIcon, SunIcon } from "../icons.ts";
import { useColorScheme } from "../theme/ColorSchemeContext.tsx";

export function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useColorScheme();

  const handleSchemeChange = (next: string) => {
    if (next === "light" || next === "dark" || next === "system") {
      setColorScheme(next);
    }
  };

  return (
    <SegmentedControl
      label="Color scheme selection"
      size="sm"
      layout="hug"
      value={colorScheme}
      onChange={handleSchemeChange}
    >
      <Tooltip content="Light mode">
        <SegmentedControlItem
          value="light"
          label="Light mode"
          isLabelHidden
          icon={<Icon icon={SunIcon} size="sm" />}
        />
      </Tooltip>
      <Tooltip content="Dark mode">
        <SegmentedControlItem
          value="dark"
          label="Dark mode"
          isLabelHidden
          icon={<Icon icon={MoonIcon} size="sm" />}
        />
      </Tooltip>
      <Tooltip content="System preference">
        <SegmentedControlItem
          value="system"
          label="System preference"
          isLabelHidden
          icon={<Icon icon={ComputerDesktopIcon} size="sm" />}
        />
      </Tooltip>
    </SegmentedControl>
  );
}
