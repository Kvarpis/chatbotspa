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

    const response = await fetch(`https://${shopifyDomain}/cart/add.js`, {
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

    // Get response as text first for debugging
    const responseText = await response.text();
    console.log('Raw Shopify response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      // Removed unused error parameter
      console.error('Failed to parse Shopify response:', responseText);
      throw new Error('Invalid response from Shopify');
    }

    if (!response.ok) {
      throw new Error(data.description || 'Failed to add to cart');
    }

    // Forward cookies from Shopify
    const shopifyCookies = response.headers.get('set-cookie');
    if (shopifyCookies) {
      res.setHeader('Set-Cookie', shopifyCookies);
    }

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
      checkoutUrl: `https://${shopifyDomain}/cart`,
      totalQuantity: cartData.item_count
    });

  } catch (err) { // Changed from error to err to differentiate
    console.error('Cart error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to add to cart',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}