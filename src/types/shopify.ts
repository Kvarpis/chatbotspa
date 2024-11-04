export interface CustomCartDrawer extends HTMLElement {
    open: () => void;
    close: () => void;
    setActiveElement: (element: HTMLElement) => void;
  }
  
  export interface ShopifyCartItem {
    id: number;
    quantity: number;
    title: string;
    price: number;
    variant_id: number;
    key?: string;
    properties?: Record<string, string>;
    line_price?: number;
    original_price?: number;
    discounted_price?: number;
    total_discount?: number;
    sku?: string;
    grams?: number;
    vendor?: string;
    url?: string;
    image?: string;
    handle?: string;
    product_title?: string;
    product_description?: string;
    variant_title?: string;
  }
  
  export interface ShopifyCart {
    token: string;
    note: string | null;
    attributes: Record<string, string>;
    original_total_price: number;
    total_price: number;
    total_discount: number;
    total_weight: number;
    item_count: number;
    items: ShopifyCartItem[];
    currency: string;
    items_subtotal_price: number;
    cart_level_discount_applications?: unknown[];
  }
  
  export interface CartAPIResponse {
    success: boolean;
    cart: ShopifyCart;
    checkoutUrl: string;
    sections?: Record<string, string>;
    totalQuantity: number;
    error?: string;
  }
  
  export interface ShopifyGlobal {
    shop?: string;
    currency?: string;
    routes?: {
      root: string;
      cart_add_url: string;
      cart_change_url: string;
      cart_update_url: string;
      cart_url: string;
      predictive_search_url: string;
    };
    onCartUpdate?: (cart: ShopifyCart) => void;
    cartUpdateCallback?: (cart: ShopifyCart) => void;
  }
  
  declare global {
    interface Window {
      Shopify?: ShopifyGlobal;
      shopifyStore?: {
        domain: string;
        name: string;
        currency: string;
      };
    }
  }
  
  // Export a type-safe helper for cart drawer
  export function isCartDrawer(element: Element | null): element is CustomCartDrawer {
    return element !== null && 'open' in element && 'close' in element;
  }