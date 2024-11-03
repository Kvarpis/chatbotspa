const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
const storefrontAccessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

if (!shopifyUrl || !storefrontAccessToken) {
  throw new Error('Missing required environment variables');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { variantId, quantity = 1 } = req.body;
    
    // Extract the numeric ID from the Storefront API variant ID
    const numericVariantId = variantId.split('/').pop();
    
    // First add to Shopify's cart
    const cartResponse = await fetch(`https://${shopifyUrl}/cart/add.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        items: [{
          id: numericVariantId,
          quantity: quantity
        }]
      })
    });

    if (!cartResponse.ok) {
      const errorData = await cartResponse.json();
      throw new Error(`Failed to add to Shopify cart: ${errorData.description || 'Unknown error'}`);
    }

    const cartData = await cartResponse.json();

    // Now also add to Storefront API cart for consistency
    let { cartId } = req.cookies;

    if (!cartId) {
      const createCartResponse = await fetch(`${req.headers.origin}/api/cart/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      const newCart = await createCartResponse.json();
      cartId = newCart.id;
    }

    const mutation = `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            lines(first: 10) {
              edges {
                node {
                  id
                  quantity
                  merchandise {
                    ... on ProductVariant {
                      id
                      title
                      price {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      cartId,
      lines: [
        {
          merchandiseId: variantId,
          quantity,
        },
      ],
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
    };

    const response = await fetch(`https://${shopifyUrl}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: mutation, variables }),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    if (data.data.cartLinesAdd.userErrors.length > 0) {
      throw new Error(data.data.cartLinesAdd.userErrors[0].message);
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');

    // Return both cart data
    return res.status(200).json({
      success: true,
      shopifyCart: cartData,
      storefrontCart: data.data.cartLinesAdd.cart
    });

  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({ 
      error: 'Failed to add item to cart',
      details: error.message
    });
  }
}