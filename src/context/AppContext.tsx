import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AppState {
  selectedTemplateUrl: string | null;
  setSelectedTemplateUrl: (url: string | null) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [selectedTemplateUrl, setSelectedTemplateUrl] = useState<string | null>(null);

  return (
    <AppContext.Provider
      value={{
        selectedTemplateUrl,
        setSelectedTemplateUrl,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
