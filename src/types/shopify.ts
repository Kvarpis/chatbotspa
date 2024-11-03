// types/shopify.ts

export interface CustomCartDrawer extends HTMLElement {
    open: () => void;
    close: () => void;
    setActiveElement: (element: HTMLElement) => void;
    // Add any other methods your cart drawer might have
  }
  
  export interface ShopifyGlobal {
    onCartUpdate?: (cart: {
      item_count: number;
      items: Array<{
        id: number;
        quantity: number;
        title: string;
        price: number;
        variant_id: number;
      }>;
      total_price: number;
      currency: string;
    }) => void;
  }
  
  declare global {
    interface Window {
      Shopify?: ShopifyGlobal;
    }
  }