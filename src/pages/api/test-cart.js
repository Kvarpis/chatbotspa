// pages/api/test-cart.js
export default async function handler(req, res) {
    try {
      // First create a cart
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
  
      const createResponse = await fetch(`https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL}/api/2023-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query: createCartMutation }),
      });
  
      const cartData = await createResponse.json();
      console.log('Cart creation response:', cartData);
  
      // Then try to add an item
      const addToCartMutation = `
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
      `;
  
      const cartId = cartData.data.cartCreate.cart.id;
      const variantId = "YOUR_TEST_VARIANT_ID"; // Replace with a real variant ID from your store
  
      const addResponse = await fetch(`https://${process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL}/api/2023-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          query: addToCartMutation,
          variables: {
            cartId,
            lines: [{ merchandiseId: variantId, quantity: 1 }]
          }
        }),
      });
  
      const addData = await addResponse.json();
      console.log('Add to cart response:', addData);
  
      return res.status(200).json({
        cartCreation: cartData,
        addToCart: addData
      });
    } catch (error) {
      console.error('Test error:', error);
      return res.status(500).json({ error: error.message });
    }
  }