// Arena theme customizations for Flowbite React
// The theme is applied via CSS classes in tailwind.config.ts
// This file provides component-level overrides

export const arenaTheme = {
  button: {
    base: "group relative flex items-center justify-center text-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-arena-bg",
    color: {
      primary:
        "bg-arena-accent text-white hover:bg-arena-accent/90 focus:ring-arena-accent shadow-lg shadow-arena-accent/25",
      secondary:
        "bg-arena-card text-arena-text hover:bg-arena-card/80 border border-arena-border focus:ring-arena-accent",
      gray: "border border-arena-border bg-transparent text-arena-text hover:bg-arena-border/50 focus:ring-arena-accent",
      dark: "bg-transparent text-arena-text hover:bg-arena-border/50 focus:ring-arena-accent",
      failure:
        "bg-arena-con text-white hover:bg-arena-con/90 focus:ring-arena-con shadow-lg shadow-arena-con/25",
      success:
        "bg-arena-pro text-white hover:bg-arena-pro/90 focus:ring-arena-pro shadow-lg shadow-arena-pro/25",
      light:
        "text-arena-accent underline-offset-4 hover:underline focus:ring-arena-accent",
    },
    disabled: "cursor-not-allowed opacity-50",
    size: {
      xs: "px-2 py-1 text-xs",
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
      xl: "px-8 py-4 text-xl",
    },
  },
  card: {
    root: {
      base: "flex rounded-xl border border-arena-border bg-arena-card text-arena-text shadow-sm transition-all duration-200",
      children: "flex h-full flex-col justify-center gap-4 p-6",
      horizontal: {
        off: "flex-col",
        on: "flex-col md:max-w-xl md:flex-row",
      },
      href: "hover:bg-arena-card/80",
    },
  },
  badge: {
    root: {
      base: "flex h-fit items-center gap-1 font-semibold",
      color: {
        info: "bg-arena-accent/20 text-arena-accent",
        gray: "bg-arena-card text-arena-text border border-arena-border",
        failure: "bg-arena-con/20 text-arena-con",
        success: "bg-arena-pro/20 text-arena-pro",
        warning: "bg-yellow-500/20 text-yellow-400",
        indigo: "bg-purple-500/20 text-purple-400",
        purple: "bg-purple-500/20 text-purple-400",
        pink: "bg-red-500/20 text-red-500",
        dark: "bg-arena-border text-arena-text-muted",
      },
      size: {
        xs: "px-2 py-0.5 text-[10px]",
        sm: "px-2.5 py-0.5 text-xs",
      },
    },
    icon: {
      off: "rounded-full",
      on: "rounded-full p-1.5",
    },
  },
  progress: {
    base: "w-full overflow-hidden rounded-full bg-arena-border",
    label: "mb-1 flex justify-between font-medium text-arena-text",
    bar: "space-x-2 rounded-full text-center font-medium leading-none text-white",
    color: {
      dark: "bg-arena-text-muted",
      blue: "bg-arena-accent",
      red: "bg-arena-con",
      green: "bg-arena-pro",
      yellow: "bg-yellow-400",
      indigo: "bg-indigo-500",
      purple: "bg-purple-500",
    },
    size: {
      sm: "h-1",
      md: "h-2",
      lg: "h-3",
      xl: "h-4",
    },
  },
  modal: {
    root: {
      base: "fixed inset-x-0 top-0 z-50 h-screen overflow-y-auto overflow-x-hidden md:inset-0 md:h-full",
      show: {
        on: "flex bg-black/80",
        off: "hidden",
      },
    },
    content: {
      base: "relative h-full w-full p-4 md:h-auto",
      inner:
        "relative flex max-h-[90dvh] flex-col rounded-xl border border-arena-border bg-arena-card shadow-lg",
    },
    body: {
      base: "flex-1 overflow-auto p-6",
    },
    header: {
      base: "flex items-start justify-between rounded-t border-b border-arena-border p-5",
      title: "text-xl font-semibold text-arena-text",
      close: {
        base: "ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5 text-sm text-arena-text-muted hover:bg-arena-border hover:text-arena-text",
        icon: "h-5 w-5",
      },
    },
    footer: {
      base: "flex items-center space-x-2 rounded-b border-t border-arena-border p-6",
    },
  },
  tooltip: {
    target: "w-fit",
    animation: "transition-opacity",
    arrow: {
      base: "absolute z-10 h-2 w-2 rotate-45",
      style: {
        dark: "bg-arena-card",
        light: "bg-arena-card",
        auto: "bg-arena-card",
      },
      placement: "-4px",
    },
    base: "absolute z-10 inline-block rounded-lg px-3 py-2 text-sm font-medium shadow-sm",
    hidden: "invisible opacity-0",
    style: {
      dark: "border border-arena-border bg-arena-card text-arena-text",
      light: "border border-arena-border bg-arena-card text-arena-text",
      auto: "border border-arena-border bg-arena-card text-arena-text",
    },
    content: "relative z-20",
  },
  dropdown: {
    arrowIcon: "ml-2 h-4 w-4",
    content: "py-1 focus:outline-none",
    floating: {
      animation: "transition-opacity",
      arrow: {
        base: "absolute z-10 h-2 w-2 rotate-45",
        style: {
          dark: "bg-arena-card",
          light: "bg-arena-card",
          auto: "bg-arena-card",
        },
        placement: "-4px",
      },
      base: "z-10 w-fit divide-y divide-arena-border rounded-lg shadow-lg focus:outline-none",
      content: "py-1 text-sm text-arena-text",
      divider: "my-1 h-px bg-arena-border",
      header: "block px-4 py-2 text-sm text-arena-text-muted",
      hidden: "invisible opacity-0",
      item: {
        container: "",
        base: "flex w-full cursor-pointer items-center justify-start px-4 py-2 text-sm text-arena-text hover:bg-arena-border/50 focus:bg-arena-border/50 focus:outline-none",
        icon: "mr-2 h-4 w-4",
      },
      style: {
        dark: "border border-arena-border bg-arena-card text-arena-text",
        light: "border border-arena-border bg-arena-card text-arena-text",
        auto: "border border-arena-border bg-arena-card text-arena-text",
      },
      target: "w-fit",
    },
    inlineWrapper: "flex items-center",
  },
};
