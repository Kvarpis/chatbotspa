export interface Product {
  id: string;
  title: string;
  description: string;
  handle: string;
  variantId: string;
  image?: {
    url: string;
    altText?: string;
  };
  price: {
    amount: string;
    currencyCode: string;
  };
}

export interface ChatMessage {
  text: string;
  isBot: boolean;
} 