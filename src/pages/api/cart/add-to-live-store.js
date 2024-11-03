// pages/api/cart/add-to-live-store.js

const SHOPIFY_STORE_URL = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

async function fetchWithCookies(url, options = {}) {
  const baseUrl = `https://${SHOPIFY_STORE_URL}`;
  const response = await fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
    }
  });
  
  return response;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { variantId, quantity = 1 } = req.body;

    // Forward cookies from the client request
    const clientCookies = req.headers.cookie || '';

    // Add to cart
    const addToCartResponse = await fetchWithCookies('/cart/add.js', {
      method: 'POST',
      headers: {
        Cookie: clientCookies
      },
      body: JSON.stringify({
        items: [{
          id: parseInt(variantId, 10),
          quantity: parseInt(quantity, 10)
        }]
      })
    });

    if (!addToCartResponse.ok) {
      const errorData = await addToCartResponse.json();
      throw new Error(errorData.description || 'Failed to add to cart');
    }

    // Get cart data
    const cartResponse = await fetchWithCookies('/cart.js', {
      headers: {
        Cookie: clientCookies
      }
    });

    const cartData = await cartResponse.json();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');

    // Forward any new cookies from Shopify's response
    const shopifyCookies = addToCartResponse.headers.get('set-cookie');
    if (shopifyCookies) {
      res.setHeader('Set-Cookie', shopifyCookies);
    }

    return res.status(200).json({
      success: true,
      cart: cartData,
      checkoutUrl: `https://${SHOPIFY_STORE_URL}/cart`,
      totalQuantity: cartData.item_count
    });

  } catch (error) {
    console.error('Cart error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
}