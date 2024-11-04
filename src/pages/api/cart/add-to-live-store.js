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
    console.log('Final numeric ID for cart:', finalId);

    // First add item to cart without sections
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
          id: finalId,
          quantity: parseInt(quantity, 10)
        }]
      })
    });

    const addToCartText = await addToCartResponse.text();
    console.log('Add to cart response:', addToCartText);

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
    const shopifyCookies = addToCartResponse.headers.raw()['set-cookie'];
    if (shopifyCookies) {
      shopifyCookies.forEach(cookie => res.setHeader('Set-Cookie', cookie));
    }

    // Now get cart data
    const cartResponse = await fetch(`https://${shopifyDomain}/cart.js`, {
      headers: {
        'Accept': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!cartResponse.ok) {
      throw new Error('Failed to fetch cart');
    }

    const cartData = await cartResponse.json();

    // Get section data
    const sectionsResponse = await fetch(`https://${shopifyDomain}/cart?view=ajax`, {
      headers: {
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': req.headers.cookie || ''
      }
    });

    const sectionsHtml = await sectionsResponse.text();

    // Return success response with all data
    return res.status(200).json({
      success: true,
      cart: cartData,
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
