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
    const mutation = `
      mutation cartCreate {
        cartCreate {
          cart {
            id
            checkoutUrl
            createdAt
            updatedAt
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

    const headers = {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
    };

    const response = await fetch(`https://${shopifyUrl}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: mutation }),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    if (data.data.cartCreate.userErrors.length > 0) {
      throw new Error(data.data.cartCreate.userErrors[0].message);
    }

    // Store cart ID in session for future use
    res.setHeader('Set-Cookie', `cartId=${data.data.cartCreate.cart.id}; Path=/; SameSite=Strict`);

    return res.status(200).json(data.data.cartCreate.cart);
  } catch (error) {
    console.error('Cart creation error:', error);
    return res.status(500).json({ error: 'Failed to create cart' });
  }
}