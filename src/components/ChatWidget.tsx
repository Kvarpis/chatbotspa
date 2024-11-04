import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, ExternalLink, ShoppingCart, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShopifySession } from '@/types/shopify';

// Type definitions
interface Config {
  STORE_URL: string | undefined;
  STOREFRONT_ACCESS_TOKEN: string | undefined;
  BOOKING_URL: string;
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
}


// Constants
const CONFIG: Config = {
  STORE_URL: process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL,
  STOREFRONT_ACCESS_TOKEN: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
  BOOKING_URL: 'https://bestill.timma.no/reservation/SeacretSpa',
  COLORS: {
    background: '#F8F6F0',
    primary: '#5e9597',
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
  welcome: "Velkommen til Seacretspa! Hvordan kan jeg hjelpe deg i dag?",
  askHelp: "Jeg kan hjelpe deg med å:\n1. Finne produkter fra butikken vår\n2. Bestille time\n3. Svare på spørsmål om våre produkter og tjenester",
  typeMessage: "Skriv din melding...",
  booking: "Bestill time",
  bookingQuestion: "Hvilken type behandling er du interessert i?\n\nVi tilbyr:\n- Ansiktsbehandling\n- Massasje\n- Voksing\n- Manikyr og Pedikyr\n",
  bookingPrompt: "Vil du se våre tilgjengelige tider?",
  addToCart: "Legg i handlekurv",
  added: "Lagt til i handlekurven!",
  error: "Beklager, det oppstod en feil. Vennligst prøv igjen.",
  loading: "Vennligst vent...",
  assistant: "Seacretspa Assistent",
  chatbubbleAria: "Åpne chat",
  outOfStock: "Utsolgt",
  adding: "Legger til...",
  bookNow: "Se tilgjengelige tider",
  quickActions: {
    title: "Hva kan jeg hjelpe deg med?",
    booking: "Bestill time",
    products: "Finn produkter",
    questions: "Andre spørsmål"
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

// Booking button component
const BookingButton: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white hover:opacity-90 transition-all duration-200"
    style={{ backgroundColor: CONFIG.COLORS.primary }}
  >
    <Calendar className="w-4 h-4" />
    {TRANSLATIONS.bookNow}
    <ExternalLink className="w-4 h-4" />
  </button>
);

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const variant = product.variants.edges[0]?.node;
  const isAvailable = variant?.availableForSale !== false;
  
  const formattedPrice = new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: product.priceRange.minVariantPrice.currencyCode || 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(parseFloat(product.priceRange.minVariantPrice.amount || "0"));

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddToCart = async (variantId: string, quantity: number = 1) => {
    console.log("Raw variant ID received:", variantId);
    
    // Extract numeric ID from the `gid://` format
    const numericVariantId = variantId.split('/').pop();
    console.log("Extracted numeric ID:", numericVariantId);
    
    if (!numericVariantId) {
      console.error("Invalid variant ID format");
      return;
    }
  
    setIsAdding(true);
    try {
      const formData = new FormData();
      formData.append('form_type', 'product');
      formData.append('utf8', '✓');
      formData.append('id', numericVariantId);
      formData.append('quantity', quantity.toString());
      formData.append('sections', 'cart-drawer');
  
      // Use a fallback URL if Shopify routes are not defined
      const cartUrl = (window as any).Shopify?.routes?.root 
        ? `${(window as any).Shopify.routes.root}cart/add.js`
        : '/cart/add.js';
  
      const response = await fetch(cartUrl, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin',
        body: formData
      });
  
      if (!response.ok) {
        throw new Error('Failed to add to cart');
      }
  
      // Trigger cart drawer open
      document.documentElement.dispatchEvent(
        new CustomEvent('cart:refresh', {
          bubbles: true
        })
      );
  
      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 2000);
  
    } catch (error) {
      console.error("Error during add to cart process:", error);
      showNotification(TRANSLATIONS.error, "error");
    } finally {
      setIsAdding(false);
    }
  };
  
  
  return (
    <div className="relative border rounded-lg p-3 mb-2 bg-white shadow-sm hover:shadow-md transition-all duration-300">
      {notification && (
        <div 
          className={`absolute -top-2 right-2 z-10 rounded-md px-3 py-1 text-white text-sm ${
            notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {notification.message}
        </div>
      )}
      
      <div className="flex gap-3">
        <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-50">
          {!imageError && product.featuredImage?.url ? (
            <img
              src={product.featuredImage.url}
              alt={product.featuredImage.altText || product.title}
              className="w-full h-full object-contain"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-medium text-gray-900 text-sm leading-tight line-clamp-2">
              {product.title}
            </h3>
            <span className="font-medium text-gray-900 text-sm whitespace-nowrap">
              {formattedPrice}
            </span>
          </div>

          <p className="mt-1 text-xs text-gray-500 line-clamp-2 flex-grow">
            {product.description}
          </p>

          <div className="mt-2 flex justify-end">
          <button
  onClick={() => {
    if (variant?.id) {
      console.log("Attempting to add variant:", variant.id); // Debug log
      handleAddToCart(variant.id);
    } else {
      console.error("No valid variant ID available.");
    }
  }}
              disabled={isAdding || !isAvailable}
              className={`
                px-3 py-1.5 rounded text-white text-xs font-medium
                transition-all duration-300
                ${isAdded ? 'bg-green-500' : ''}
                ${!isAvailable ? 'bg-gray-400' : ''}
                ${!isAdded && isAvailable ? 'hover:opacity-90' : ''}
              `}
              style={{ 
                backgroundColor: isAdded ? '#22c55e' : 
                               !isAvailable ? '#9CA3AF' : 
                               CONFIG.COLORS.primary 
              }}
            >
              {isAdding ? (
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Legger til...
                </span>
              ) : isAdded ? (
                <span>✓ Lagt til</span>
              ) : !isAvailable ? (
                'Utsolgt'
              ) : (
                'Legg i handlekurv'
              )}
            </button>
          </div>
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
  onBooking: () => void;
  onProducts: () => void;
  onQuestions: () => void;
}> = ({ onBooking, onProducts, onQuestions }) => (
  <div className="border-t mt-4 pt-4">
    <p className="text-sm mb-2 text-center font-medium" style={{ color: CONFIG.COLORS.text }}>
      {TRANSLATIONS.quickActions.title}
    </p>
    <div className="flex flex-col gap-2">
      <button
        onClick={onBooking}
        className="w-full px-4 py-2 text-sm rounded-lg border transition-colors hover:bg-gray-50"
        style={{ borderColor: CONFIG.COLORS.primary, color: CONFIG.COLORS.primary }}
      >
        {TRANSLATIONS.quickActions.booking}
      </button>
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
      className={`rounded-2xl px-4 py-2 max-w-[80%] shadow-sm ${
        isBot 
          ? 'rounded-tl-sm bg-white border border-gray-200' 
          : 'rounded-tr-sm text-white'
      }`}
      style={{
        backgroundColor: isBot ? 'white' : CONFIG.COLORS.primary,
        wordBreak: 'break-word'
      }}
    >
      {message}
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

  const handleBooking = () => {
    addMessage(TRANSLATIONS.bookingQuestion, true);
    setTimeout(() => {
      addMessage(TRANSLATIONS.bookingPrompt, true);
      addMessage(
        <BookingButton
          onClick={() => {
            window.open(CONFIG.BOOKING_URL, '_blank');
            addMessage("Jeg har åpnet bestillingssiden i en ny fane for deg.", true);
          }}
        />,
        true
      );
    }, 500);
  };

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
          }]
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
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
      console.error('Chat error:', error);
      addMessage(TRANSLATIONS.error, true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Wrapper with specific z-index and positioning for Shopify integration
    <div className="chat wrapper fixed bottom-4 right-4" style={{ zIndex: 999 }}>
      <div className="relative isolate pointer-events-auto">
        {chatState === CHAT_STATES.MINIMIZED ? (
          <Button
            aria-label={TRANSLATIONS.chatbubbleAria}
            size="icon"
            className="rounded-full w-14 h-14 shadow-lg flex items-center justify-center hover:scale-105 transition-transform relative"
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
            className="w-96 shadow-xl transition-all duration-300 transform"
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
              <div className="h-[500px] flex flex-col">
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
                
                <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-4">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isLoading ? TRANSLATIONS.loading : TRANSLATIONS.typeMessage}
                    className="flex-1 bg-white focus:ring-2 focus:ring-primary focus:border-transparent"
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
                    onBooking={handleBooking}
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
    </div>
  );
};

export default SeacretspaChatWidget;