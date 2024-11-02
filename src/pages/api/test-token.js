// pages/api/test-token.js
export default async function handler(req, res) {
    try {
      const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
      const accessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  
      const response = await fetch(`https://${shopifyUrl}/api/unstable/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Shopify-Storefront-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query: `
            {
              shop {
                name
                description
              }
            }
          `
        })
      });
  
      const data = await response.json();
      
      return res.status(200).json({
        success: true,
        status: response.status,
        headers: Object.fromEntries(response.headers),
        data: data,
        debug: {
          url: shopifyUrl,
          tokenPrefix: accessToken ? `${accessToken.substring(0, 6)}...` : null
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }