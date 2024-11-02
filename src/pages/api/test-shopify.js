// pages/api/test-store.js
export default async function handler(req, res) {
    try {
      const shopifyUrl = 'seacretspano.myshopify.com';
      const accessToken = '20d539032da7b7a2c9ef5d3d4f45e72b';
  
      const response = await fetch(`https://${shopifyUrl}/api/2023-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Changed from X-Shopify-Access-Token to this
          'X-Shopify-Storefront-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query: `
            {
              products(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          `
        })
      });
  
      const text = await response.text();
      console.log('Raw response:', text);
  
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.log('Parse error:', e);
      }
  
      // Return full details for debugging
      return res.status(200).json({
        success: true,
        request: {
          url: `https://${shopifyUrl}/api/2023-10/graphql.json`,
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': accessToken.substring(0, 6) + '...'
          },
          query: "products(first: 1)"
        },
        response: {
          status: response.status,
          headers: Object.fromEntries(response.headers),
          data: data,
          text: text.substring(0, 1000)
        }
      });
  
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
  }