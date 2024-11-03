// pages/api/cart/add.js
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
    console.log('Adding to cart:', { variantId, quantity });
    
    // Get cart ID from cookie
    let cartId = req.cookies.cartId;
    console.log('Current cartId:', cartId);

    if (!cartId) {
      console.log('No cart found, creating new cart...');
      const createCartResponse = await fetch(`${req.headers.origin}/api/cart/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!createCartResponse.ok) {
        throw new Error('Failed to create new cart');
      }
      
      const newCart = await createCartResponse.json();
      cartId = newCart.cart.id;
    }

    // First, check if the item is already in the cart
    const checkCartQuery = `
      query getCart($cartId: ID!) {
        cart(id: $cartId) {
          totalQuantity
          lines(first: 100) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `;

    const checkResponse = await fetch(`https://${shopifyUrl}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
      },
      body: JSON.stringify({
        query: checkCartQuery,
        variables: { cartId }
      }),
    });

    const checkData = await checkResponse.json();
    const existingLine = checkData.data?.cart?.lines?.edges?.find(
      edge => edge.node.merchandise.id === variantId
    );

    if (existingLine) {
      // Update existing line
      const updateMutation = `
        mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
          cartLinesUpdate(cartId: $cartId, lines: $lines) {
            cart {
              id
              totalQuantity
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

      const updateVariables = {
        cartId,
        lines: [{
          id: existingLine.node.id,
          quantity: existingLine.node.quantity + quantity
        }]
      };

      const updateResponse = await fetch(`https://${shopifyUrl}/api/2023-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
        },
        body: JSON.stringify({
          query: updateMutation,
          variables: updateVariables
        }),
      });

      const updateData = await updateResponse.json();
      return res.status(200).json({
        success: true,
        cart: updateData.data.cartLinesUpdate.cart,
        checkoutUrl: updateData.data.cartLinesUpdate.cart.checkoutUrl,
        totalQuantity: updateData.data.cartLinesUpdate.cart.totalQuantity || 0
      });
    }

    // If item not in cart, add as new line
    const addToCartMutation = `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id
            totalQuantity
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

    const variables = {
      cartId,
      lines: [
        {
          merchandiseId: variantId,
          quantity: parseInt(quantity, 10)
        },
      ],
    };

    console.log('Making Shopify API call with:', variables);

    const response = await fetch(`https://${shopifyUrl}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
      },
      body: JSON.stringify({
        query: addToCartMutation,
        variables,
      }),
    });

    const data = await response.json();
    console.log('Shopify API response:', data);
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error(data.errors[0].message);
    }

    if (data.data?.cartLinesAdd?.userErrors?.length > 0) {
      console.error('Cart add errors:', data.data.cartLinesAdd.userErrors);
      throw new Error(data.data.cartLinesAdd.userErrors[0].message);
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');

    return res.status(200).json({
      success: true,
      cart: data.data.cartLinesAdd.cart,
      checkoutUrl: data.data.cartLinesAdd.cart.checkoutUrl,
      totalQuantity: data.data.cartLinesAdd.cart.totalQuantity || 0
    });

  } catch (error) {
    console.error('Detailed error:', error);
    return res.status(400).json({
      success: false,
      message: error.message,
      error: error.toString()
    });
  }
}