/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AppProvider } from "./context/AppContext";
import { SlideBuilder } from "./pages/SlideBuilder";

export default function App() {
  return (
    <AppProvider>
      <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <SlideBuilder />
        </main>
      </div>
    </AppProvider>
  );
}
