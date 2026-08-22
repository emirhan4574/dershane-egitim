import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/** ≥ bu genişlik masaüstü kabuğu */
export const DESKTOP_MIN_WIDTH = 900;

type LayoutValue = {
  width: number;
  isMobile: boolean;
  isDesktop: boolean;
};

const LayoutContext = createContext<LayoutValue>({
  width: 390,
  isMobile: true,
  isDesktop: false,
});

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const value = useMemo(() => {
    const isDesktop = width >= DESKTOP_MIN_WIDTH;
    return { width, isDesktop, isMobile: !isDesktop };
  }, [width]);

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  return useContext(LayoutContext);
}
