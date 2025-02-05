import React, { useEffect, useState } from 'react';
import SeacretspaChatWidget from '@/components/ChatWidget';
import Head from 'next/head';
import { ShopifySession } from '@/types/shopify';

interface SessionState {
  isReady: boolean;
  shopifyData: ShopifySession;
  cookies: Record<string, string>;
}

export default function EmbedPage() {
  const [session, setSession] = useState<SessionState>({
    isReady: false,
    shopifyData: {} as ShopifySession,
    cookies: {}
  });

  useEffect(() => {
    // Function to parse URL parameters
    const getUrlParams = () => {
      const params = new URLSearchParams(window.location.search);
      return {
        cart: params.get('cart') || '',
        shop_session: params.get('shop_session') || '',
        shop_domain: params.get('shop_domain') || ''
      };
    };

    // Setup communication with parent window
    const handleParentMessage = (event: MessageEvent) => {
      // Verify origin is from allowed domains
      const allowedOrigins = [
        'https://farskapet.no',
        'http://localhost:3000',
        'https://chatbotspa.vercel.app'
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        console.warn('Received message from unauthorized origin:', event.origin);
        return;
      }

      // Handle different message types
      switch (event.data?.type) {
        case 'INIT_SESSION':
          console.log('Initializing session with:', event.data);
          setSession({
            isReady: true,
            shopifyData: event.data.shopifyData || ({} as ShopifySession),
            cookies: event.data.cookies || {}
          });
          break;

        case 'SESSION_UPDATE':
          console.log('Updating session with:', event.data);
          setSession(prev => ({
            ...prev,
            shopifyData: {
              ...prev.shopifyData,
              ...event.data.shopifyData
            },
            cookies: {
              ...prev.cookies,
              ...event.data.cookies
            }
          }));
          break;

        case 'CART_UPDATE':
          console.log('Cart updated:', event.data);
          setSession(prev => ({
            ...prev,
            shopifyData: {
              ...prev.shopifyData,
              cartToken: event.data.cartToken
            }
          }));
          break;

        default:
          console.log('Received message:', event.data);
      }
    };

    // Add message listener
    window.addEventListener('message', handleParentMessage);

    // Initialize with URL parameters
    const urlParams = getUrlParams();
    if (urlParams.cart || urlParams.shop_session) {
      setSession(prev => ({
        ...prev,
        shopifyData: {
          ...prev.shopifyData,
          cartToken: urlParams.cart,
          sessionToken: urlParams.shop_session,
          shop: urlParams.shop_domain
        }
      }));
    }

    // Let parent know we're ready
    if (window.parent !== window) {
      window.parent.postMessage({ 
        type: 'CHAT_READY',
        needsSession: true
      }, '*');
    }

    // Request session data periodically
    const sessionCheckInterval = setInterval(() => {
      if (window.parent !== window) {
        window.parent.postMessage({ 
          type: 'REQUEST_SESSION'
        }, '*');
      }
    }, 5000); // Check every 5 seconds

    return () => {
      window.removeEventListener('message', handleParentMessage);
      clearInterval(sessionCheckInterval);
    };
  }, []);

  // Function to send messages back to parent
  const sendMessageToParent = (message: Record<string, unknown>) => {
    if (window.parent !== window) {
      window.parent.postMessage(message, '*');
    }
  };

  return (
    <>
      <Head>
        <title>Seacretspa Chat</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>
      
      <div id="chat-container">
        {session.isReady ? (
          <SeacretspaChatWidget 
            shopifySession={session.shopifyData}
            cookies={session.cookies}
            onSessionUpdate={(sessionData: Record<string, unknown>) => {
              sendMessageToParent({
                type: 'SESSION_UPDATE',
                ...sessionData
              });
            }}
          />
        ) : (
          <div className="loading">Loading...</div>
        )}
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

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
          font-family: system-ui, sans-serif;
        }
      `}</style>
    </>
  );
}

// Get initial props from server
export const getServerSideProps = async ({ query }: { query: Record<string, string> }) => {
  return {
    props: {
      initialSession: {
        cart: query.cart || null,
        shop_session: query.shop_session || null,
        shop_domain: query.shop_domain || null
      }
    }
  };
};

SeacretspaChatWidget.defaultProps = {
  shopifySession: {} as ShopifySession,
  cookies: {},
  onSessionUpdate: () => {}
};
