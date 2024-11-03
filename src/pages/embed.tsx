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
          background: transparent !important;
        }
        
        #__next {
          position: fixed;
          bottom: 0;
          right: 0;
        }
      `}</style>
    </>
  );
}