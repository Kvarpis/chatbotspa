import React, { useEffect } from 'react';
import SeacretspaChatWidget from '@/components/ChatWidget';
import Head from 'next/head';

export default function EmbedPage() {
  useEffect(() => {
    // Setup communication with parent window
    const handleParentMessage = (event: MessageEvent) => {
      // Verify origin is from allowed domains
      const allowedOrigins = [
        'https://seacretspano.myshopify.com',
        'http://localhost:3000',
        'https://chatbotspa.vercel.app'
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('Received message from unauthorized origin:', event.origin);
        return;
      }

      // Handle any messages from parent
      if (event.data?.type === 'SHOP_INFO') {
        console.log('Received shop info:', event.data);
        // You can store this in state if needed
      }
    };

    window.addEventListener('message', handleParentMessage);

    // Let parent know we're ready
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'CHAT_READY' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleParentMessage);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Seacretspa Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      
      <div id="chat-container">
        <SeacretspaChatWidget />
      </div>

      <style jsx global>{`
        html, 
        body {
          margin: 0;
          padding: 0;
          background: transparent !important;
          overflow: hidden;
        }
        
        #__next {
          position: fixed;
          bottom: 0;
          right: 0;
          width: 100%;
          height: 100%;
        }

        #chat-container {
          width: 100%;
          height: 100%;
          position: relative;
        }
      `}</style>
    </>
  );
}

// Disable automatic static optimization for this page
export const getServerSideProps = async () => {
  return {
    props: {
      // You can pass any needed props here
    },
  };
};