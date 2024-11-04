// src/pages/api/cart/add-to-live-store.js
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
    if (variantId.includes('gid://shopify/ProductVariant/')) {
      numericId = variantId.split('gid://shopify/ProductVariant/')[1];
    } else if (variantId.includes('/')) {
      numericId = variantId.split('/').pop();
    } else {
      numericId = variantId;
    }

    console.log('Original variant ID:', variantId);
    console.log('Extracted numeric ID:', numericId);

    // Validate numeric ID
    if (!numericId || isNaN(parseInt(numericId, 10))) {
      throw new Error(`Invalid variant ID: ${variantId}`);
    }

    const finalId = parseInt(numericId, 10);

    // Add to cart
    const addToCartResponse = await fetch(`https://${shopifyDomain}/cart/add.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include',
      body: JSON.stringify({
        items: [{ id: finalId, quantity: parseInt(quantity, 10) }]
      })
    });

    const addToCartData = await addToCartResponse.json();

    // Forward cookies from Shopify
    const shopifyCookies = addToCartResponse.headers.get('set-cookie');
    if (shopifyCookies) {
      res.setHeader('Set-Cookie', shopifyCookies);
    }

    // Get updated cart data
    const cartResponse = await fetch(`https://${shopifyDomain}/cart.js`, {
      headers: {
        'Accept': 'application/json',
        'Cookie': shopifyCookies || req.headers.cookie || '',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const cartData = await cartResponse.json();

    // Get sections data
    const sectionsResponse = await fetch(`https://${shopifyDomain}/cart?view=ajax`, {
      headers: {
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': shopifyCookies || req.headers.cookie || ''
      }
    });

    const sectionsHtml = await sectionsResponse.text();

    // Return all necessary data
    return res.status(200).json({
      success: true,
      cart: cartData,
      addedItems: addToCartData.items,
      sections: {
        'cart-items': sectionsHtml,
        'cart-icon-bubble': sectionsHtml,
        'cart-live-region-text': sectionsHtml,
        'cart-drawer': sectionsHtml
      },
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