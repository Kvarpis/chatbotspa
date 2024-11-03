// pages/api/cart/add-to-live-store.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  
    try {
      const { variantId, quantity = 1 } = req.body;
      console.log('Processing add to cart:', { variantId, quantity });
  
      // First, create a cart
      const createCartResponse = await fetch(`https://${shopifyStore}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
          'Shopify-Storefront-Private-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
        },
        body: JSON.stringify({
          query: `
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
          `
        })
      });
  
      console.log('Create cart response status:', createCartResponse.status);
      const createCartData = await createCartResponse.json();
      console.log('Create cart response:', createCartData);
  
      if (!createCartData.data) {
        throw new Error(`Failed to create cart: ${JSON.stringify(createCartData.errors || createCartData)}`);
      }
  
      const cartId = createCartData.data.cartCreate.cart.id;
  
      // Now add items to the cart
      const addItemResponse = await fetch(`https://${shopifyStore}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
          'Shopify-Storefront-Private-Token': process.env.SHOPIFY_STOREFRONT_TOKEN
        },
        body: JSON.stringify({
          query: `
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
                            priceV2 {
                              amount
                              currencyCode
                            }
                          }
                        }
                      }
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
          `,
          variables: {
            cartId,
            lines: [
              {
                merchandiseId: variantId,
                quantity: parseInt(quantity, 10)
              }
            ]
          }
        })
      });
  
      console.log('Add item response status:', addItemResponse.status);
      const addItemData = await addItemResponse.json();
      console.log('Add item response:', addItemData);
  
      if (!addItemData.data) {
        throw new Error(`Failed to add item to cart: ${JSON.stringify(addItemData.errors || addItemData)}`);
      }
  
      if (addItemData.data.cartLinesAdd.userErrors.length > 0) {
        throw new Error(addItemData.data.cartLinesAdd.userErrors[0].message);
      }
  
      const cart = addItemData.data.cartLinesAdd.cart;
      const totalQuantity = cart.lines.edges.reduce((sum, edge) => sum + edge.node.quantity, 0);
  
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
      // Set cart ID cookie
      res.setHeader('Set-Cookie', `cart_id=${cartId}; Path=/; SameSite=Lax`);
  
      return res.status(200).json({
        success: true,
        cart: {
          id: cart.id,
          lines: cart.lines,
          checkoutUrl: cart.checkoutUrl
        },
        totalQuantity,
        redirectToCheckout: cart.checkoutUrl
      });
  
    } catch (error) {
      console.error('Cart error:', error);
      return res.status(500).json({ 
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }