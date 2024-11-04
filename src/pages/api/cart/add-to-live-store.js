// pages/api/cart/add-to-live-store.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { variantId, quantity = 1 } = req.body;
    const shopifyDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    if (!shopifyDomain) {
      throw new Error('Shopify domain not configured');
    }

    // Extract numeric ID from GraphQL ID
    let numericId;
    if (variantId.includes('ProductVariant/')) {
      numericId = variantId.split('ProductVariant/')[1];
    } else if (variantId.includes('/')) {
      numericId = variantId.split('/').pop();
    } else {
      numericId = variantId;
    }

    // Validate numeric ID
    if (!numericId || isNaN(parseInt(numericId, 10))) {
      throw new Error(`Invalid variant ID: ${variantId}`);
    }

    console.log('Adding to cart with numeric ID:', numericId);

    // Add to cart
    const addToCartResponse = await fetch(`https://${shopifyDomain}/cart/add.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        items: [{
          id: parseInt(numericId, 10),
          quantity: parseInt(quantity, 10)
        }]
      })
    });

    const addToCartText = await addToCartResponse.text();
    console.log('Raw add to cart response:', addToCartText);

    let addToCartData;
    try {
      addToCartData = JSON.parse(addToCartText);
    } catch {
      console.error('Failed to parse add to cart response:', addToCartText);
      throw new Error('Invalid response from Shopify');
    }

    if (!addToCartResponse.ok) {
      throw new Error(addToCartData.description || 'Failed to add to cart');
    }

    // Forward cookies from Shopify
    const shopifyCookies = addToCartResponse.headers.get('set-cookie');
    if (shopifyCookies) {
      res.setHeader('Set-Cookie', shopifyCookies);
    }

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

    // Get updated cart
    const cartResponse = await fetch(`https://${shopifyDomain}/cart.js`, {
      headers: {
        'Accept': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const cartData = await cartResponse.json();

    return res.status(200).json({
      success: true,
      cart: cartData,
      sections: sectionsMap,
      checkoutUrl: `https://${shopifyDomain}/cart`,
      totalQuantity: cartData.item_count
    });

  } catch (err) {
    console.error('Cart error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to add to cart',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

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