import React from 'react';
import SeacretspaChatWidget from '@/components/ChatWidget';

export default function EmbedPage() {
  return (
    <>
      <SeacretspaChatWidget />
      <style jsx global>{`
        html, 
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: transparent !important;
        }
        
        /* This ensures the widget stays in bottom right */
        #__next {
          position: fixed;
          bottom: 0;
          right: 0;
          width: 420px;  /* Match your chat widget width */
          pointer-events: none;
        }
        
        /* Enable pointer events only for the chat */
        .chat-wrapper {
          pointer-events: auto;
        }
      `}</style>
    </>
  );
}