import React from 'react';
import { AppProvider } from '@/lib/context';
import { TimekeepingApp } from '@/components/TimekeepingApp';

export default function HomePage() {
  return (
    <AppProvider>
      <TimekeepingApp />
    </AppProvider>
  );
}
