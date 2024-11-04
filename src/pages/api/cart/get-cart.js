// File 2: src/pages/api/cart/get-cart.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const shopifyDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    if (!shopifyDomain) {
      throw new Error('Shopify domain not configured');
    }

    // Get cart data
    const cartResponse = await fetch(`https://${shopifyDomain}/cart.js`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!cartResponse.ok) {
      throw new Error(`Failed to fetch cart: ${cartResponse.status}`);
    }

    const cart = await cartResponse.json();

    // Get sections data
    const sections = ['cart-items', 'cart-icon-bubble', 'cart-live-region-text', 'cart-drawer'];
    const sectionsPromises = sections.map(section =>
      fetch(`https://${shopifyDomain}?section_id=${section}`, {
        headers: {
          'Accept': 'text/html',
          'Cookie': req.headers.cookie || '',
        }
      }).then(response => response.text())
    );

    const sectionsData = await Promise.all(sectionsPromises);
    const sectionsMap = Object.fromEntries(
      sections.map((section, index) => [section, sectionsData[index]])
    );

    // Forward cookies from Shopify
    const shopifyCookies = cartResponse.headers.get('set-cookie');
    if (shopifyCookies) {
      res.setHeader('Set-Cookie', shopifyCookies);
    }

    return res.status(200).json({
      success: true,
      cart: cart,
      sections: sectionsMap,
      checkoutUrl: `https://${shopifyDomain}/cart`,
      totalQuantity: cart.item_count
    });

  } catch (error) {
    console.error('Cart fetch error:', error);
    // Return empty cart with sections
    const sections = ['cart-items', 'cart-icon-bubble', 'cart-live-region-text', 'cart-drawer'];
    const sectionsMap = Object.fromEntries(
      sections.map(section => [section, ''])
    );

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
      sections: sectionsMap,
      checkoutUrl: `https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL}/cart`,
      totalQuantity: 0
    });
  }
}