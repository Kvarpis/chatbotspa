// pages/api/cart/create.js
const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
const storefrontAccessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

if (!shopifyUrl || !storefrontAccessToken) {
  throw new Error('Missing required environment variables');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Starting cart creation...');
  console.log('Shop URL:', shopifyUrl);
  console.log('Has Access Token:', !!storefrontAccessToken);

  try {
    const mutation = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        buyerIdentity {
          countryCode
        }
        lines(first: 10) {
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
        totalQuantity
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const variables = {
  input: {
    buyerIdentity: {
      countryCode: "NO"
    }
  }
};

const response = await fetch(`https://${shopifyUrl}/api/2023-10/graphql.json`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
  },
  body: JSON.stringify({ 
    query: mutation,
    variables 
  }),
});

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error response:', errorText);
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Cart creation response:', data);

    // Check for GraphQL errors
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error(data.errors[0].message);
    }

    // Check for user errors
    if (data.data?.cartCreate?.userErrors?.length > 0) {
      console.error('Cart creation user errors:', data.data.cartCreate.userErrors);
      throw new Error(data.data.cartCreate.userErrors[0].message);
    }

    const cart = data.data?.cartCreate?.cart;
    if (!cart) {
      throw new Error('No cart data in response');
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    
    // Set cart ID cookie
    res.setHeader(
      'Set-Cookie', 
      `cartId=${cart.id}; Path=/; SameSite=None; Secure`
    );

    // Include totalQuantity in the response
    return res.status(200).json({
      success: true,
      cart: cart,
      totalQuantity: cart.totalQuantity || 0
    });

  } catch (error) {
    console.error('Cart creation error:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.toString()
    });
  }
}