import React from 'react';
import SeacretspaChatWidget from '@/components/ChatWidget';

export default function Home() {
  return (
    <main>
      <SeacretspaChatWidget 
        shopifySession={{}}
        cookies={{}}
        onSessionUpdate={() => {}}
      />
    </main>
  );
}

// Add these to your existing types
export type ChatState = 'HIDDEN' | 'MINIMIZED' | 'OPEN';

export interface WindowWithChat extends Window {
  handleChatStateChange?: (state: ChatState) => void;
}

declare global {
  interface Window {
    handleChatStateChange?: (state: ChatState) => void;
  }
}