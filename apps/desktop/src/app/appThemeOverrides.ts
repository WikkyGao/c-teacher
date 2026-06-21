import type { GlobalThemeOverrides } from "naive-ui";
import type { AppThemeKey } from "../features/children/childStore";

export type AppThemeTokens = {
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  primaryReadable: string;
  primarySoft: string;
  text: string;
  muted: string;
  panel: string;
  panelRaised: string;
  border: string;
};

export const appThemeTokens: Record<AppThemeKey, AppThemeTokens> = {
  turquoise: {
    primary: "#0d6f65",
    primaryHover: "#128579",
    primaryPressed: "#084b45",
    primaryReadable: "#084b45",
    primarySoft: "#e5f3ef",
    text: "#17212b",
    muted: "#46515f",
    panel: "#ffffff",
    panelRaised: "#fafaf7",
    border: "#cbd7d0"
  },
  night: {
    primary: "#78d9c8",
    primaryHover: "#9be8db",
    primaryPressed: "#cbfff5",
    primaryReadable: "#cbfff5",
    primarySoft: "#153f3b",
    text: "#f3fbff",
    muted: "#dbe8ef",
    panel: "#223445",
    panelRaised: "#172735",
    border: "#5b7183"
  },
  blue: {
    primary: "#1769d4",
    primaryHover: "#2d7ee8",
    primaryPressed: "#0b3f8a",
    primaryReadable: "#0b3f8a",
    primarySoft: "#e7f0ff",
    text: "#142033",
    muted: "#3c4a5e",
    panel: "#ffffff",
    panelRaised: "#fbfdff",
    border: "#bdd0e8"
  },
  plum: {
    primary: "#7b4e8f",
    primaryHover: "#9464aa",
    primaryPressed: "#4c2c5c",
    primaryReadable: "#4c2c5c",
    primarySoft: "#f2e8f6",
    text: "#231c2a",
    muted: "#514657",
    panel: "#ffffff",
    panelRaised: "#fffafd",
    border: "#d1c1d8"
  }
};

export function naiveThemeOverridesFor(themeKey: AppThemeKey): GlobalThemeOverrides {
  const theme = appThemeTokens[themeKey];
  return {
    common: {
      primaryColor: theme.primary,
      primaryColorHover: theme.primaryHover,
      primaryColorPressed: theme.primaryPressed,
      primaryColorSuppl: theme.primaryHover,
      textColor1: theme.text,
      textColor2: theme.text,
      textColor3: theme.muted,
      placeholderColor: theme.muted,
      borderColor: theme.border,
      dividerColor: theme.border,
      bodyColor: theme.panel,
      cardColor: theme.panel,
      modalColor: theme.panel,
      popoverColor: theme.panel,
      tableColor: theme.panel,
      inputColor: theme.panel,
      inputColorDisabled: theme.panelRaised,
      hoverColor: theme.primarySoft
    },
    Button: {
      textColor: theme.text,
      textColorHover: theme.primaryReadable,
      textColorPressed: theme.primaryReadable,
      textColorFocus: theme.primaryReadable,
      textColorText: theme.text,
      textColorTextHover: theme.primaryReadable,
      textColorTextPressed: theme.primaryReadable,
      textColorTextFocus: theme.primaryReadable,
      textColorGhost: theme.text,
      textColorGhostHover: theme.primaryReadable,
      textColorGhostPressed: theme.primaryReadable,
      textColorGhostFocus: theme.primaryReadable,
      colorPrimary: theme.primaryReadable,
      colorHoverPrimary: theme.primaryReadable,
      colorPressedPrimary: theme.primaryReadable,
      colorFocusPrimary: theme.primaryReadable,
      textColorTextPrimary: theme.primaryReadable,
      textColorTextHoverPrimary: theme.primaryReadable,
      textColorTextPressedPrimary: theme.primaryReadable,
      textColorTextFocusPrimary: theme.primaryReadable,
      textColorGhostPrimary: theme.primaryReadable,
      textColorGhostHoverPrimary: theme.primaryReadable,
      textColorGhostPressedPrimary: theme.primaryReadable,
      textColorGhostFocusPrimary: theme.primaryReadable,
      colorInfo: theme.text,
      colorHoverInfo: theme.text,
      colorPressedInfo: theme.text,
      colorFocusInfo: theme.text,
      colorSuccess: theme.primaryReadable,
      colorHoverSuccess: theme.primaryReadable,
      colorPressedSuccess: theme.primaryReadable,
      colorFocusSuccess: theme.primaryReadable,
      colorWarning: theme.text,
      colorHoverWarning: theme.text,
      colorPressedWarning: theme.text,
      colorFocusWarning: theme.text,
      colorSecondary: theme.panel,
      colorSecondaryHover: theme.panelRaised,
      colorSecondaryPressed: theme.primarySoft,
      colorTertiary: theme.panelRaised,
      colorTertiaryHover: theme.primarySoft,
      colorTertiaryPressed: theme.primarySoft,
      colorQuaternary: "#0000",
      colorQuaternaryHover: theme.primarySoft,
      colorQuaternaryPressed: theme.primarySoft,
      border: `1px solid ${theme.border}`,
      borderHover: `1px solid ${theme.primary}`,
      borderPressed: `1px solid ${theme.primaryPressed}`,
      borderFocus: `1px solid ${theme.primary}`,
      color: theme.panel,
      colorHover: theme.panelRaised,
      colorPressed: theme.primarySoft,
      colorFocus: theme.panelRaised
    },
    Card: {
      color: theme.panel,
      textColor: theme.text,
      titleTextColor: theme.text,
      borderColor: theme.border
    },
    DatePicker: {
      itemTextColor: theme.text,
      itemTextColorHover: theme.text,
      itemTextColorActive: theme.text,
      panelColor: theme.panel,
      calendarTitleTextColor: theme.text
    },
    Form: {
      labelTextColor: theme.text,
      feedbackTextColorWarning: theme.text
    },
    Input: {
      color: theme.panel,
      colorFocus: theme.panel,
      textColor: theme.text,
      placeholderColor: theme.muted,
      border: `1px solid ${theme.border}`,
      borderHover: `1px solid ${theme.primary}`,
      borderFocus: `1px solid ${theme.primary}`,
      caretColor: theme.primary
    },
    InputNumber: {
      peers: {
        Input: {
          color: theme.panel,
          colorFocus: theme.panel,
          textColor: theme.text,
          placeholderColor: theme.muted,
          border: `1px solid ${theme.border}`,
          borderHover: `1px solid ${theme.primary}`,
          borderFocus: `1px solid ${theme.primary}`
        }
      }
    },
    Modal: {
      color: theme.panel,
      textColor: theme.text,
      titleTextColor: theme.text
    },
    Popover: {
      color: theme.panel,
      textColor: theme.text
    },
    Select: {
      peers: {
        InternalSelection: {
          color: theme.panel,
          colorActive: theme.panel,
          textColor: theme.text,
          placeholderColor: theme.muted,
          border: `1px solid ${theme.border}`,
          borderHover: `1px solid ${theme.primary}`,
          borderActive: `1px solid ${theme.primary}`
        },
        InternalSelectMenu: {
          color: theme.panel,
          optionTextColor: theme.text,
          optionTextColorActive: theme.primaryPressed,
          optionTextColorPressed: theme.primaryPressed,
          optionColorPending: theme.primarySoft,
          optionColorActive: theme.primarySoft
        }
      }
    },
    Tag: {
      textColor: theme.text,
      border: `1px solid ${theme.border}`,
      color: theme.panelRaised
    }
  };
}
