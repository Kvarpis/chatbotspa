import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, ExternalLink, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShopifySession } from '@/types/shopify';

// Type definitions
interface Config {
  STORE_URL: string | undefined;
  STOREFRONT_ACCESS_TOKEN: string | undefined;
  COLORS: {
    background: string;
    primary: string;
    text: string;
    lightText: string;
  };
}

// Type definitions
interface SessionUpdateData {
  cartToken?: string;
  totalQuantity?: number;
  lastUpdated?: string;
  [key: string]: unknown;
}

// Single definition of the props interface with proper typing
interface SeacretspaChatWidgetProps {
  shopifySession: ShopifySession;
  cookies: Record<string, string>;
  onSessionUpdate: (sessionData: SessionUpdateData) => void;
}

interface CartResponse {
  error?: string;
  success: boolean;
  cart?: {
    id: string;
    checkoutUrl: string;
    totalQuantity: number;
    lines: {
      edges: Array<{
        node: {
          id: string;
          quantity: number;
          merchandise: {
            id: string;
            title: string;
            price: {
              amount: string;
              currencyCode: string;
            };
          };
        };
      }>;
    };
  };
}

interface Message {
  text: string | React.ReactNode;
  isBot: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  handle: string;
  featuredImage?: {
    url: string;
    altText?: string;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
        availableForSale?: boolean;
        price?: {
          amount: string;
          currencyCode: string;
        };
      };
    }>;
  };
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode?: string;
    };
  };
  available?: boolean;
  url: string;
}

interface ShopifyWindow extends Window {
  Shopify?: ShopifyGlobal;
}

interface ShopifyGlobal {
  routes?: {
    root: string;
    cart_add_url: string;
    cart_change_url: string;
    cart_update_url: string;
    cart_url: string;
    predictive_search_url: string;
  };
}

// Constants
const CONFIG: Config = {
  STORE_URL: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL,
  STOREFRONT_ACCESS_TOKEN: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
  COLORS: {
    background: '#f2fcff',
    primary: '#8ec6db',
    text: '#333333',
    lightText: '#666666'
  }
};

const CHAT_STATES = {
  MINIMIZED: 'minimized',
  EXPANDED: 'expanded',
  HIDDEN: 'hidden'
} as const;

type ChatState = typeof CHAT_STATES[keyof typeof CHAT_STATES];

// Enhanced Norwegian translations
const TRANSLATIONS = {
  welcome: "Velkommen til Farskapet! Hvordan kan jeg hjelpe deg i dag?",
  askHelp: "Jeg kan hjelpe deg med å:\n1. Finne produkter fra butikken vår\n2. Svare på spørsmål om våre produkter\n3. Hjelpe med kundeservice henvendelser",
  typeMessage: "Skriv din melding...",
  error: "Beklager, det oppstod en feil. Vennligst prøv igjen.",
  loading: "Vennligst vent...",
  assistant: "Farskapet Assistent",
  chatbubbleAria: "Åpne chat",
  outOfStock: "Utsolgt",
  adding: "Legger til...",
  quickActions: {
    title: "Hva kan jeg hjelpe deg med?",
    products: "Finn produkter",
    questions: "Andre spørsmål",
    support: "Kundeservice"
  }
};

// Chat bubble icon
const ChatBubbleIcon: React.FC = () => (
  <svg 
    viewBox="0 0 24 24" 
    className="w-6 h-6" 
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
  </svg>
);

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  
  const variant = product.variants.edges[0]?.node;
  const isAvailable = variant?.availableForSale !== false;
  const price = product.priceRange?.minVariantPrice?.amount 
    ? `${parseFloat(product.priceRange.minVariantPrice.amount).toLocaleString('nb-NO')} kr` 
    : '-';

  const productUrl = `${process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL}/products/${product.handle}`;

  const showNotification = (message: string, type: 'success' | 'error') => {
    // Implementation of showNotification function
  };

  const extractVariantId = (gid: string): number | null => {
    try {
      const matches = gid.match(/\/ProductVariant\/(\d+)/);
      if (matches && matches[1]) {
        return parseInt(matches[1], 10);
      }
      return null;
    } catch (error) {
      console.error("Error extracting variant ID:", error);
      return null;
    }
  };

  const handleAddToCart = async (graphqlId: string, quantity: number = 1) => {
    const numericId = extractVariantId(graphqlId);
    if (!numericId) return;
  
    setIsAdding(true);
    
    try {
      // Send add to cart request to parent window
      window.parent.postMessage({
        type: 'ADD_TO_CART',
        variantId: numericId,
        quantity: quantity
      }, '*');
      setIsAdded(true);
      showNotification("Added to cart", "success");
      setTimeout(() => setIsAdded(false), 2000);
    } catch (error) {
      console.error("Error adding to cart:", error);
      showNotification("An error occurred", "error");
    } finally {
      setIsAdding(false);
    }
  };
  
  
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 bg-white">
      <img
        src={product.featuredImage?.url}
        alt={product.featuredImage?.altText || product.title}
        className="w-16 h-16 object-cover rounded flex-shrink-0"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-shrink">
            <a 
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline line-clamp-2"
              style={{ color: CONFIG.COLORS.primary }}
            >
              {product.title}
            </a>
          </div>
          <span className="text-sm font-medium whitespace-nowrap flex-shrink-0">
            {price}
          </span>
        </div>

        <div className="flex gap-2 mt-2">
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 flex items-center justify-center rounded border transition-colors hover:bg-gray-50"
            style={{ 
              borderColor: CONFIG.COLORS.primary,
              color: CONFIG.COLORS.primary 
            }}
            title="Se produkt"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          
          <button
            onClick={() => handleAddToCart(variant?.id)}
            disabled={isAdding || !isAvailable}
            className="w-8 h-8 flex items-center justify-center rounded transition-colors"
            style={{ 
              backgroundColor: isAdded ? '#22c55e' : 
                             !isAvailable ? '#9CA3AF' : 
                             CONFIG.COLORS.primary,
              opacity: (isAdding || !isAvailable) ? 0.7 : 1
            }}
            title={
              isAdding ? 'Legger til...' : 
              isAdded ? 'Lagt til' : 
              !isAvailable ? 'Utsolgt' : 
              'Legg i handlekurv'
            }
          >
            <ShoppingCart className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Typing indicator component
const TypingIndicator: React.FC = () => (
  <div className="flex justify-start mb-4">
    <div 
      className="rounded-lg px-4 py-2"
      style={{ backgroundColor: CONFIG.COLORS.background }}
    >
      <div className="flex gap-1">
        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

// Quick actions component
const QuickActions: React.FC<{
  onProducts: () => void;
  onQuestions: () => void;
}> = ({ onProducts, onQuestions }) => (
  <div className="border-t mt-4 pt-4">
    <p className="text-sm mb-2 text-center font-medium" style={{ color: CONFIG.COLORS.text }}>
      {TRANSLATIONS.quickActions.title}
    </p>
    <div className="flex flex-col gap-2">
      <button
        onClick={onProducts}
        className="w-full px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
        style={{ borderColor: CONFIG.COLORS.primary, color: CONFIG.COLORS.primary }}
      >
        {TRANSLATIONS.quickActions.products}
      </button>
      <button
        onClick={onQuestions}
        className="w-full px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
        style={{ borderColor: CONFIG.COLORS.primary, color: CONFIG.COLORS.primary }}
      >
        {TRANSLATIONS.quickActions.questions}
      </button>
    </div>
  </div>
);

const ChatMessage: React.FC<{ message: string | React.ReactNode; isBot: boolean }> = ({ message, isBot }) => (
  <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}>
    <div 
      className={`rounded-2xl px-4 py-3 max-w-[80%] shadow-sm ${
        isBot 
          ? 'rounded-tl-sm bg-white border border-gray-200 text-gray-800' 
          : 'rounded-tr-sm text-white'
      }`}
      style={{
        backgroundColor: isBot ? 'white' : CONFIG.COLORS.primary,
        wordBreak: 'break-word',
        fontSize: '0.9375rem',
        lineHeight: '1.5',
        letterSpacing: '0.01em'
      }}
    >
      {typeof message === 'string' ? (
        <div className="whitespace-pre-line">
          {message.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i !== message.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      ) : (
        message
      )}
    </div>
  </div>
);

// Chat message component
const SeacretspaChatWidget: React.FC<SeacretspaChatWidgetProps> = ({
  shopifySession,
  cookies,
  onSessionUpdate
}) => {
  const [messages, setMessages] = useState<Message[]>([
    { text: TRANSLATIONS.welcome, isBot: true },
    { text: TRANSLATIONS.askHelp, isBot: true }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatState, setChatState] = useState<ChatState>(CHAT_STATES.MINIMIZED);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [cartData, setCartData] = useState<CartResponse['cart']>();

  // Memoized updateSession function
  const updateSession = useCallback((cartData?: SessionUpdateData) => {
    const updatedData = {
      ...cartData,
      lastUpdated: new Date().toISOString()
    };
    onSessionUpdate(updatedData);
  }, [onSessionUpdate]);

  // Initialize chat session ID on mount
  useEffect(() => {
    if (!localStorage.getItem('chatSessionId')) {
      localStorage.setItem('chatSessionId', Math.random().toString(36).substring(7));
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Post message to parent when chat state changes
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage(
        chatState === CHAT_STATES.EXPANDED ? 'expand' : 'minimize',
        '*'
      );
    }
  }, [chatState]);

  // Monitor Shopify session
  useEffect(() => {
    if (shopifySession.shop) {
      console.log('Shopify session:', shopifySession);
    }
  }, [shopifySession]);

  // Monitor cookies
  useEffect(() => {
    if (cookies["user_session"]) {
      console.log("User session is active:", cookies["user_session"]);
    }
  }, [cookies]);

  // Cart data tracking
  useEffect(() => {
    if (cartData) {
      console.log('Cart updated:', cartData.totalQuantity, 'items');
      // Add any cart-specific UI updates here
    }
  }, [cartData]);

  const addMessage = (text: string | React.ReactNode, isBot: boolean) => {
    setMessages(prev => [...prev, { text, isBot }]);
  };

  // Fetch cart functionality
  const fetchCart = useCallback(async (): Promise<CartResponse> => {
    try {
      const response = await fetch('/api/cart/get-cart', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching cart:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch cart'
      };
    }
  }, []);

  // Load cart with proper dependencies
  const loadCart = useCallback(async () => {
    try {
      const response = await fetchCart();
      
      if (response.success && response.cart) {
        setCartData(response.cart);
        updateSession({
          cartToken: response.cart.id,
          totalQuantity: response.cart.totalQuantity
        });
      } else if (response.error) {
        console.error('Cart fetch error:', response.error);
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
    }
  }, [fetchCart, updateSession]);

  // Load cart on mount and when session changes
  useEffect(() => {
    loadCart();
  }, [loadCart, shopifySession.cartToken]);

  const handleQuickProducts = async () => {
    const productMessage = "Vis meg produkter";
    addMessage(productMessage, false);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: productMessage
          }],
          sessionId: localStorage.getItem('chatSessionId')
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error('Failed to get products');
      }

      if (data.hasProductCard && data.products) {
        addMessage(data.content, true);
        data.products.forEach((product: Product) => {
          addMessage(
            <ProductCard 
              product={product}
              key={product.id}
            />,
            true
          );
        });
      } else {
        addMessage(data.content, true);
      }
    } catch (error) {
      console.error('Products error:', error);
      addMessage(TRANSLATIONS.error, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    addMessage(userMessage, false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: userMessage
          }],
          sessionId: localStorage.getItem('chatSessionId')
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      if (data.hasProductCard && data.products) {
        // Add a single message containing both text and products
        addMessage(
          <div>
            <p className="mb-3">{data.content}</p>
            <div className="space-y-2">
              {data.products.map((product: Product) => (
                <ProductCard 
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          </div>,
          true
        );
      } else {
        addMessage(data.content, true);
      }
    } catch (error) {
      console.error('Chat error:', error);
      addMessage(TRANSLATIONS.error, true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-wrapper fixed md:bottom-4 md:right-4 bottom-0 right-0" style={{ zIndex: 999 }}>
      <div className="relative isolate pointer-events-auto">
        {chatState === CHAT_STATES.MINIMIZED ? (
          <Button
            aria-label={TRANSLATIONS.chatbubbleAria}
            size="icon"
            className="rounded-full w-12 h-12 md:w-14 md:h-14 shadow-lg flex items-center justify-center hover:scale-105 transition-transform relative md:mb-0 mb-4 md:mr-0 mr-4"
            onClick={() => setChatState(CHAT_STATES.EXPANDED)}
            style={{ 
              backgroundColor: CONFIG.COLORS.primary,
              transform: 'rotate(-5deg)'
            }}
          >
            <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full" 
              style={{ backgroundColor: CONFIG.COLORS.primary }} 
            />
            <ChatBubbleIcon />
          </Button>
        ) : (
          <Card 
            className="w-full md:w-96 shadow-xl transition-all duration-300 transform max-h-[100vh] md:max-h-[600px]"
            style={{ backgroundColor: CONFIG.COLORS.background }}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h2 className="font-semibold" style={{ color: CONFIG.COLORS.text }}>
                  {TRANSLATIONS.assistant}
                </h2>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setChatState(CHAT_STATES.MINIMIZED)}
                className="hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardContent className="p-4">
              <div className="h-[calc(100vh-8rem)] md:h-[500px] flex flex-col">
                <ScrollArea className="flex-1 pr-4 overflow-y-auto">
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <ChatMessage
                        key={index}
                        message={message.text}
                        isBot={message.isBot}
                      />
                    ))}
                    {isLoading && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                
                <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-4 sticky bottom-0 bg-inherit pb-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isLoading ? TRANSLATIONS.loading : TRANSLATIONS.typeMessage}
                    className="flex-1 bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ fontSize: '16px' }}
                    disabled={isLoading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  <Button 
                    type="submit"
                    variant="default"
                    size="icon"
                    disabled={isLoading || !input.trim()}
                    className="transition-all duration-200 hover:scale-105"
                    style={{ 
                      backgroundColor: CONFIG.COLORS.primary,
                      opacity: (!input.trim() || isLoading) ? 0.5 : 1 
                    }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>

                {messages.length <= 2 && !isLoading && (
                  <QuickActions 
                    onProducts={handleQuickProducts}
                    onQuestions={() => {
                      addMessage("Hvilke spørsmål har du? Jeg er her for å hjelpe!", true);
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .chat-wrapper {
            width: 100% !important;
          }
          
          .chat-wrapper > div > div[role="dialog"] {
            position: fixed !important;
            bottom: 0 !important;
            right: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            max-height: 90vh !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SeacretspaChatWidget;