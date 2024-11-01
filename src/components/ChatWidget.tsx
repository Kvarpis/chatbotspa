import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button, ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

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

interface Message {
  text: string | React.ReactNode;
  isBot: boolean;
}

interface Product {
  id: string;
  title: string;
  description: string;
  featuredImage?: {
    url: string;
  };
  variants: {
    edges: Array<{
      node: {
        id: string;
      };
    }>;
  };
  priceRange: {
    minVariantPrice: {
      amount: string;
    };
  };
}

// Constants for easy configuration
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

// Norwegian translations
const TRANSLATIONS = {
  welcome: "Velkommen til Seacretspa! Hvordan kan jeg hjelpe deg i dag?",
  askHelp: "Jeg kan hjelpe deg med å:\n1. Finne produkter fra butikken vår\n2. Bestille time\n3. Svare på spørsmål om våre produkter og tjenester",
  typeMessage: "Skriv din melding...",
  booking: "Bestill time",
  addToCart: "Legg i handlekurv",
  added: "Lagt til i handlekurven!",
  error: "Beklager, det oppstod en feil. Vennligst prøv igjen.",
  bookingRedirect: "Klikk her for å bestille time:",
  loading: "Vennligst vent...",
  assistant: "Seacretspa Assistent",
  chatbubbleAria: "Åpne chat"
};

// Chat bubble SVG icon component
const ChatBubbleIcon: React.FC = () => (
  <svg 
    viewBox="0 0 24 24" 
    className="w-8 h-8" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09775 17.1962 4.85316 19.0003C4.85316 19.0003 4.11842 20.5003 2 22C2 22 5.5 21.5 7.75 20.5C9.15125 21.4875 10.5188 22 12 22Z" 
      stroke="white" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

// Styled button component
interface StyledButtonProps extends ButtonProps {
  children: React.ReactNode;
}

const StyledButton: React.FC<StyledButtonProps> = ({ children, style, ...props }) => (
  <Button 
    {...props} 
    style={{
      backgroundColor: CONFIG.COLORS.primary,
      color: 'white',
      ...style
    }}
  >
    {children}
  </Button>
);

// Chat message component
interface ChatMessageProps {
  message: string | React.ReactNode;
  isBot: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isBot }) => (
  <div className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}>
    <div 
      className="rounded-lg px-4 py-2 max-w-[80%]"
      style={{
        backgroundColor: isBot ? CONFIG.COLORS.background : CONFIG.COLORS.primary,
        color: isBot ? CONFIG.COLORS.text : 'white',
        wordBreak: 'break-word'
      }}
    >
      {message}
    </div>
  </div>
);

// Product card component
interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => (
  <div 
    className="rounded-lg p-4 mb-4 hover:shadow-lg transition-shadow"
    style={{ backgroundColor: 'white', border: `1px solid ${CONFIG.COLORS.primary}` }}
  >
    <div className="flex items-start gap-4">
      {product.featuredImage && (
        <img 
          src={product.featuredImage.url} 
          alt={product.title}
          className="w-20 h-20 object-cover rounded"
        />
      )}
      <div className="flex-1">
        <h3 className="font-bold" style={{ color: CONFIG.COLORS.text }}>{product.title}</h3>
        <p className="text-sm line-clamp-2" style={{ color: CONFIG.COLORS.lightText }}>{product.description}</p>
        <div className="flex justify-between items-center mt-2">
          <span className="font-semibold">
            {new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(Number(product.priceRange.minVariantPrice.amount))}
          </span>
          <StyledButton onClick={() => onAddToCart(product)}>
            {TRANSLATIONS.addToCart}
          </StyledButton>
        </div>
      </div>
    </div>
  </div>
);

// Main chat widget component
const SeacretspaChatWidget: React.FC = () => {
  const [chatState, setChatState] = useState<ChatState>(CHAT_STATES.HIDDEN);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cartId, setCartId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show widget after a short delay
    setTimeout(() => setChatState(CHAT_STATES.MINIMIZED), 2000);
    // Initialize cart
    initializeCart();
  }, []);

  useEffect(() => {
    if (chatState === CHAT_STATES.EXPANDED && messages.length === 0) {
      addMessage(TRANSLATIONS.welcome, true);
      addMessage(TRANSLATIONS.askHelp, true);
    }
  }, [chatState]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initializeCart = async () => {
    try {
      console.log('Initializing cart...');
      const response = await fetch('/api/cart/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      const contentType = response.headers.get("content-type");
      console.log('Response content type:', contentType);
      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cart initialization failed:', {
          status: response.status,
          body: errorText
        });
        return;
      }

      if (!contentType || !contentType.includes("application/json")) {
        console.error('Invalid content type:', contentType);
        return;
      }

      const data = await response.json();
      console.log('Cart initialization response:', data);

      if (!data.success || !data.cartId) {
        console.error('Invalid cart response:', data);
        return;
      }

      console.log('Cart initialized successfully:', data.cartId);
      setCartId(data.cartId);
    } catch (error) {
      console.error('Cart initialization error:', error);
      // Don't throw here, just log the error
    }
  };

  const addMessage = (text: string | React.ReactNode, isBot: boolean) => {
    setMessages(prev => [...prev, { text, isBot }]);
  };

  const handleBookingRequest = () => {
    addMessage(TRANSLATIONS.bookingRedirect, true);
    addMessage(
      <div className="flex flex-col gap-2">
        <StyledButton 
          className="flex items-center gap-2"
          onClick={() => window.open(CONFIG.BOOKING_URL, '_blank')}
        >
          {TRANSLATIONS.booking} <ExternalLink className="h-4 w-4" />
        </StyledButton>
      </div>,
      true
    );
  };

  const handleAddToCart = async (product: Product) => {
    if (!cartId) {
      await initializeCart();
      if (!cartId) {
        addMessage(TRANSLATIONS.error, true);
        return;
      }
    }
    
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cartId,
          merchandiseId: product.variants.edges[0].node.id,
          quantity: 1
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to cart');
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Add to cart response is not JSON");
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add to cart');
      }

      addMessage(`${product.title} - ${TRANSLATIONS.added}`, true);
    } catch (error) {
      console.error('Add to cart error:', error);
      addMessage(`${TRANSLATIONS.error} (${error instanceof Error ? error.message : 'Unknown error'})`, true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
  
    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
  
    // Add user message immediately
    addMessage(userMessage, false);
  
    // Filter messages to only include those with text as a string
    const messagesToSend = [...messages, { text: userMessage, isBot: false }]
      .filter(msg => typeof msg.text === 'string');
  
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesToSend
        })
      });
  
      // Check if response is ok and is json
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }
  
      const data = await response.json();
  
      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }
  
      // Handle booking requests
      if (data.hasBooking) {
        handleBookingRequest();
        return;
      }
  
      // Handle product requests
      if (data.hasProductCard && data.products) {
        addMessage(data.content, true);
        data.products.forEach((product: Product) => {
          addMessage(
            <ProductCard 
              product={product}
              onAddToCart={handleAddToCart}
            />,
            true
          );
        });
        return;
      }
  
      // Regular message
      addMessage(data.content, true);
  
    } catch (error) {
      console.error('Chat error:', error);
      addMessage(
        `${TRANSLATIONS.error} (${error instanceof Error ? error.message : 'Unknown error'})`, 
        true
      );
    } finally {
      setIsLoading(false);
    }
  };  

  if (chatState === CHAT_STATES.HIDDEN) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {chatState === CHAT_STATES.MINIMIZED ? (
        <Button
          aria-label={TRANSLATIONS.chatbubbleAria}
          size="lg"
          className="rounded-full w-16 h-16 shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
          onClick={() => setChatState(CHAT_STATES.EXPANDED)}
          style={{ backgroundColor: CONFIG.COLORS.primary }}
        >
          <ChatBubbleIcon />
        </Button>
      ) : (
        <Card 
          className="w-96"
          style={{ backgroundColor: CONFIG.COLORS.background }}
        >
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-semibold" style={{ color: CONFIG.COLORS.text }}>
              {TRANSLATIONS.assistant}
            </h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setChatState(CHAT_STATES.MINIMIZED)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-4">
            <div className="h-[500px] flex flex-col">
              <ScrollArea className="flex-1 pr-4">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={index}
                    message={message.text}
                    isBot={message.isBot}
                  />
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>
              
              <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-4">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isLoading ? TRANSLATIONS.loading : TRANSLATIONS.typeMessage}
                  className="flex-1"
                  disabled={isLoading}
                  style={{ backgroundColor: 'white' }}
                />
                <StyledButton 
                  type="submit"
                  size="icon"
                  disabled={isLoading}
                >
                  <Send className="h-4 w-4" />
                </StyledButton>
              </form>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SeacretspaChatWidget;