// pages/api/cart/add-to-live-store.js
import { headers } from 'next/headers';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN; // Make sure this is set in your .env

  try {
    const { variantId, quantity = 1 } = req.body;
    console.log('Processing add to cart:', { variantId, quantity });

    // Create a cart if one doesn't exist
    let cartId = req.cookies.cart_id;
    
    if (!cartId) {
      const createCartMutation = `
        mutation cartCreate {
          cartCreate {
            cart {
              id
              checkoutUrl
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const createCartResponse = await fetch(`https://${shopifyStore}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
          query: createCartMutation
        })
      });

      const createCartData = await createCartResponse.json();
      cartId = createCartData.data.cartCreate.cart.id;
      
      // Set the cart ID cookie
      res.setHeader('Set-Cookie', `cart_id=${cartId}; Path=/; SameSite=Lax`);
    }

    // Add items to cart
    const addToCartMutation = `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            lines(first: 100) {
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
            cost {
              totalAmount {
                amount
                currencyCode
              }
            }
            checkoutUrl
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const addToCartResponse = await fetch(`https://${shopifyStore}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({
        query: addToCartMutation,
        variables: {
          cartId,
          lines: [
            {
              merchandiseId: variantId,
              quantity
            }
          ]
        }
      })
    });

    const addToCartData = await addToCartResponse.json();
    console.log('Add to cart response:', addToCartData);

    if (addToCartData.data.cartLinesAdd.userErrors.length > 0) {
      throw new Error(addToCartData.data.cartLinesAdd.userErrors[0].message);
    }

    const cart = addToCartData.data.cartLinesAdd.cart;
    const totalQuantity = cart.lines.edges.reduce((sum, edge) => sum + edge.node.quantity, 0);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');

    return res.status(200).json({
      success: true,
      cart: {
        id: cart.id,
        lines: cart.lines,
        cost: cart.cost,
        checkoutUrl: cart.checkoutUrl
      },
      totalQuantity,
      redirectToCheckout: cart.checkoutUrl
    });

  } catch (error) {
    console.error('Cart error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to add to cart'
    });
  }
}