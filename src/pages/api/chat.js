// pages/api/chat.js
import { Anthropic, HUMAN_PROMPT, AI_PROMPT } from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Validate API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Missing Anthropic API key');
    }

    // Validate request body
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format: messages must be an array',
      });
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    // Define the system message
    const systemMessage = {
      role: 'system',
      content: `Du er en kundeserviceassistent for Seacretspa, en eksklusiv spa og skjønnhetsbutikk i Norge.
        VIKTIGE REGLER:
        1. Svar alltid på norsk med en vennlig og profesjonell tone
        2. Hold svarene korte og presise
        3. For timebestilling:
           - Hvis kunden ønsker å bestille time, svar med nøyaktig: "BOOKING_REQUEST"
           - Ikke inkluder annen tekst med BOOKING_REQUEST
        4. For produktforespørsler:
           - Hvis kunden spør om produkter, svar med: "PRODUCT_REQUEST:[kategori]"
           - Kategorier: hudpleie, kroppspleie, makeup, hår, negler
           - Eksempel: "PRODUCT_REQUEST:hudpleie"`
    };

    // Filter out messages where msg.text is not a string (e.g., React components)
    const filteredMessages = messages.filter(msg => typeof msg.text === 'string');

    // Format messages into a single prompt string
    let prompt = '';

    // Add system message
    prompt += `${HUMAN_PROMPT} ${systemMessage.content.trim()}\n`;

    // Append each message to the prompt
    filteredMessages.forEach((msg) => {
      const rolePrompt = msg.isBot ? AI_PROMPT : HUMAN_PROMPT;
      prompt += `${rolePrompt} ${msg.text.trim()}\n`;
    });

    // Add the AI prompt at the end to indicate that it's the assistant's turn to speak
    prompt += AI_PROMPT;

    // Make Anthropic API call
    const response = await anthropic.completions.create({
      model: 'claude-2',
      max_tokens_to_sample: 1024,
      prompt: prompt,
      temperature: 0.7,
    });

    // Validate response
    if (!response?.completion) {
      throw new Error('Invalid response from Anthropic API');
    }

    const content = response.completion.trim();

    // Handle booking requests
    if (content === 'BOOKING_REQUEST') {
      return res.status(200).json({
        success: true,
        content: 'For å bestille time, klikk på lenken under:',
        hasBooking: true,
        bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL,
      });
    }

    // Handle product requests
    const productMatch = content.match(/PRODUCT_REQUEST:(\w+)/);
    if (productMatch) {
      const category = productMatch[1];
      try {
        const products = await getProductsByCategory(category);
        return res.status(200).json({
          success: true,
          content: `Her er noen ${category}-produkter vi anbefaler:`,
          hasProductCard: true,
          products,
        });
      } catch (error) {
        console.error('Product fetch error:', error);
        return res.status(200).json({
          success: true,
          content: `Beklager, jeg kunne ikke hente ${category}-produkter akkurat nå. Kan jeg hjelpe deg med noe annet?`,
        });
      }
    }

    // Regular response
    return res.status(200).json({
      success: true,
      content: content,
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred',
    });
  }
}

async function getProductsByCategory(category) {
  try {
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const accessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

    if (!shopifyUrl || !accessToken) {
      throw new Error('Missing Shopify configuration');
    }

    const response = await fetch(`https://${shopifyUrl}/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: `
          query ProductsByCategory($category: String!) {
            products(first: 3, query: $category) {
              edges {
                node {
                  id
                  title
                  description
                  featuredImage {
                    url
                  }
                  priceRange {
                    minVariantPrice {
                      amount
                    }
                  }
                  variants(first: 1) {
                    edges {
                      node {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { category }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} - ${JSON.stringify(data)}`);
    }

    if (!data.data?.products?.edges) {
      throw new Error('Invalid product data from Shopify');
    }

    return data.data.products.edges.map(edge => edge.node);
  } catch (error) {
    console.error('Shopify API Error:', error);
    throw error;
  }
}
