// pages/api/cart/add-to-live-store.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    
    try {
      const { variantId, quantity } = req.body;
      
      const response = await fetch(`https://${shopifyUrl}/cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            id: parseInt(variantId, 10),  // Ensure it's a number
            quantity: parseInt(quantity, 10)
          }]
        })
      });
  
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      console.error('Error adding to live store cart:', error);
      res.status(500).json({ error: error.message });
    }
  }