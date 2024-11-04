// pages/api/cart/get-cart.js

export default async function handler(req, res) {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    try {
      const shopifyDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
      
      if (!shopifyDomain) {
        throw new Error('Shopify domain not configured');
      }
  
      // Forward the request to Shopify
      const response = await fetch(`https://${shopifyDomain}/cart.js`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || '',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
  
      if (!response.ok) {
        throw new Error(`Failed to fetch cart: ${response.status}`);
      }
  
      const cart = await response.json();
  
      // Forward any cookies from Shopify
      const shopifyCookies = response.headers.get('set-cookie');
      if (shopifyCookies) {
        res.setHeader('Set-Cookie', shopifyCookies);
      }
  
      return res.status(200).json({
        success: true,
        cart: cart,
        checkoutUrl: `https://${shopifyDomain}/cart`,
        totalQuantity: cart.item_count
      });
  
    } catch (error) {
      console.error('Cart fetch error:', error);
      return res.status(200).json({
        success: true,
        cart: {
          token: null,
          note: null,
          attributes: {},
          original_total_price: 0,
          total_price: 0,
          total_discount: 0,
          total_weight: 0,
          item_count: 0,
          items: [],
          requires_shipping: false,
          currency: "NOK",
          items_subtotal_price: 0,
          cart_level_discount_applications: []
        },
        checkoutUrl: `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL}/cart`,
        totalQuantity: 0
      });
    }
  }