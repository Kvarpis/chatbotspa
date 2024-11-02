export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { variantId, quantity } = req.body;
    
    // Add to Shopify cart using Storefront API
    const response = await fetch(`https://seacretspano.myshopify.com/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: `
          mutation cartCreate($input: CartInput!) {
            cartCreate(input: $input) {
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
        `,
        variables: {
          input: {
            lines: [
              {
                quantity: quantity,
                merchandiseId: variantId
              }
            ]
          }
        }
      })
    });

    const data = await response.json();
    
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }

    return res.status(200).json({ 
      success: true, 
      cart: data.data.cartCreate.cart 
    });
    
  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({ error: 'Failed to add item to cart' });
  }
} 