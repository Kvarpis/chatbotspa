// pages/api/cart/add-to-live-store.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyStore = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const storefrontToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  
    try {
      const { variantId, quantity = 1 } = req.body;
      console.log('Processing cart request:', { variantId, quantity });
  
      // Format the variant ID correctly
      const formattedVariantId = variantId.includes('gid://') 
        ? variantId 
        : `gid://shopify/ProductVariant/${variantId}`;
  
      // Create cart using Storefront API
      const cartCreateMutation = `
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
  
      const cartResponse = await fetch(`https://${shopifyStore}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': storefrontToken
        },
        body: JSON.stringify({
          query: cartCreateMutation
        })
      });
  
      const cartData = await cartResponse.json();
      console.log('Cart create response:', cartData);
  
      if (!cartData.data?.cartCreate?.cart?.id) {
        throw new Error('Failed to create cart');
      }
  
      const cartId = cartData.data.cartCreate.cart.id;
  
      // Add items to cart
      const addItemsMutation = `
        mutation addItemsToCart($cartId: ID!, $lines: [CartLineInput!]!) {
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
              totalQuantity
              cost {
                totalAmount {
                  amount
                  currencyCode
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
  
      const addItemsResponse = await fetch(`https://${shopifyStore}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': storefrontToken
        },
        body: JSON.stringify({
          query: addItemsMutation,
          variables: {
            cartId,
            lines: [
              {
                merchandiseId: formattedVariantId,
                quantity: parseInt(quantity, 10)
              }
            ]
          }
        })
      });
  
      const addItemsData = await addItemsResponse.json();
      console.log('Add items response:', addItemsData);
  
      if (addItemsData.data?.cartLinesAdd?.userErrors?.length > 0) {
        throw new Error(addItemsData.data.cartLinesAdd.userErrors[0].message);
      }
  
      const updatedCart = addItemsData.data?.cartLinesAdd?.cart;
  
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  
      // Return success response
      return res.status(200).json({
        success: true,
        cart: {
          id: updatedCart.id,
          checkoutUrl: updatedCart.checkoutUrl,
          totalQuantity: updatedCart.totalQuantity,
          cost: updatedCart.cost,
          lines: updatedCart.lines
        }
      });
  
    } catch (error) {
      console.error('Cart operation failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        debug: process.env.NODE_ENV === 'development' ? {
          stack: error.stack,
          message: error.message
        } : undefined
      });
    }
  }