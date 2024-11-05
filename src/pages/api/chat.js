// pages/api/chat.js
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Cache for collections and tags
let shopifyMetadataCache = {
  collections: null,
  lastFetched: null
};

// Fetch all collections from Shopify
async function fetchShopifyMetadata() {
  try {
    // Only fetch if cache is empty or older than 1 hour
    if (shopifyMetadataCache.collections && 
        shopifyMetadataCache.lastFetched && 
        (Date.now() - shopifyMetadataCache.lastFetched) < 3600000) {
      return shopifyMetadataCache.collections;
    }

    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const accessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

    const query = `
      {
        collections(first: 250) {
          edges {
            node {
              id
              title
              handle
              description
              products(first: 250) {
                edges {
                  node {
                    id
                    tags
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${shopifyUrl}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': accessToken,
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const collections = data.data?.collections?.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description,
      productIds: edge.node.products.edges.map(prod => prod.node.id),
      productTags: edge.node.products.edges.reduce((tags, prod) => {
        return [...new Set([...tags, ...(prod.node.tags || [])])];
      }, [])
    })) || [];

    shopifyMetadataCache = {
      collections,
      lastFetched: Date.now()
    };

    return collections;
  } catch (error) {
    console.error('Error fetching Shopify metadata:', error);
    return shopifyMetadataCache.collections || [];
  }
}

// Enhanced search function using Shopify collections and tags
async function searchProducts(searchTerm, previousProducts = []) {
  try {
    const [allProducts, collections] = await Promise.all([
      getAllProducts(),
      fetchShopifyMetadata()
    ]);

    if (!allProducts || allProducts.length === 0) {
      console.error('No products found in store');
      return [];
    }

    const normalizedSearchTerm = searchTerm.toLowerCase().trim();

    // Find matching collections based on title or handle
    const matchingCollections = collections.filter(collection => 
      fuzzyMatch(collection.title, normalizedSearchTerm) || 
      fuzzyMatch(collection.handle, normalizedSearchTerm)
    );

    // Get all product IDs from matching collections
    const collectionProductIds = new Set(
      matchingCollections.flatMap(collection => collection.productIds)
    );

    // Filter and score products
    const scoredProducts = allProducts
      .filter(product => product.available)
      .map(product => {
        let score = 0;
        
        // Collection match
        if (collectionProductIds.has(product.id)) {
          score += 15;
        }

        // Title match
        if (fuzzyMatch(product.title, normalizedSearchTerm)) {
          score += 10;
        }
        
        // Description match
        if (product.description && fuzzyMatch(product.description, normalizedSearchTerm)) {
          score += 5;
        }

        // Tag matches (if product has tags that match collection tags)
        const productTags = product.tags || [];
        const matchingCollectionTags = matchingCollections.flatMap(c => c.productTags);
        const tagMatches = productTags.filter(tag => 
          matchingCollectionTags.some(collectionTag => fuzzyMatch(tag, collectionTag))
        );
        score += tagMatches.length * 3;
        
        return { ...product, relevanceScore: score };
      })
      .filter(product => product.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Filter out previously shown products
    return scoredProducts
      .filter(product => !previousProducts.includes(product.id))
      .slice(0, 3);

  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

// Updated GraphQL query to include tags
async function getAllProducts() {
  try {
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const accessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

    const query = `
      {
        products(first: 250) {
          edges {
            node {
              id
              title
              description
              handle
              tags
              availableForSale
              featuredImage {
                url
                altText
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 1) {
                edges {
                  node {
                    id
                    availableForSale
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
              }
              collections(first: 10) {
                edges {
                  node {
                    id
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${shopifyUrl}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': accessToken,
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    return (data.data?.products?.edges || []).map(edge => {
      const node = edge.node;
      const variant = node.variants.edges[0]?.node;
      
      return {
        id: node.id,
        title: node.title,
        description: node.description || '',
        handle: node.handle,
        tags: node.tags || [],
        featuredImage: node.featuredImage ? {
          url: node.featuredImage.url,
          altText: node.featuredImage.altText || node.title
        } : null,
        variants: {
          edges: [{
            node: {
              id: variant?.id
            }
          }]
        },
        priceRange: {
          minVariantPrice: {
            amount: variant?.price?.amount || node.priceRange?.minVariantPrice?.amount || "0",
            currencyCode: variant?.price?.currencyCode || 'NOK'
          }
        },
        available: node.availableForSale,
        collections: node.collections
      };
    });
  } catch (error) {
    console.error('Error fetching all products:', error);
    return [];
  }
}

// Store shown products in memory (consider using Redis or similar for production)
const shownProductsCache = new Map();

// Enhanced system prompt for better product understanding
const systemPrompt = `
Du er en konsis kundeservice-assistent for Seacret Spa.

HOVEDOPPGAVER:
1. Produktanbefalinger - Bruk "PRODUCT_REQUEST:<søkeord>"
2. Behandlingsinfo - Vis kun når det spørres spesifikt
3. Bestilling - Bruk "BOOKING_REQUEST" i svaret
4. Kontaktinfo - Kort og konsist

REGLER FOR SVAR:
1. Maks 1-2 setninger for generelle spørsmål
2. Unngå lange forklaringer
3. For behandlinger, bruk nummerert format:
   1. Behandling (pris)
   2. Behandling (pris)

SVAREKSEMPLER:
Bruker: "Jeg har tørr hud"
Svar: "PRODUCT_REQUEST:fuktighetskrem"

Bruker: "Når er dere åpne?"
Svar: "Vi holder til i Olsrød Park og du kan nå oss på 91594152 for timebestilling."

Bruker: "Hvilke ansiktsbehandlinger har dere?"
Svar: "Vi tilbyr følgende ansiktsbehandlinger:
1. Signaturbehandling (1650 kr)
2. Classic (1150 kr)
3. Peeling Marine (1150 kr)
4. Lunch-Behandling (880 kr)"

BEHANDLINGER:

Medisinsk:
- Konsultasjon kosmetisk sykepleier
- Godkjenning av lege for rynkebehandling (300 kr)
- Acne peel sykepleier (1600 kr)
- Medisinsk dermapen4 (3000 kr)
- Medisinsk dermapen4 m/Mesoterapi (3600 kr)
- Mesoterapi (2000 kr)
- Signaturbehandling sykepleier (4200 kr)
- Rynkebehandling (ett område: 2000 kr, to områder: 3000 kr, tre områder: 4000 kr)
- Muskelavslappende behandlinger (Nakke: 2000 kr, Kjeve: 3500 kr, Armhule: 4500 kr)
- Plexr (2500 kr)
- MeLine Peel (2000 kr)
- Profhilo (2ml: 3500 kr, 3ml: 4500 kr)
- Revok50 (2900 kr)
- Plexr øyelokk (øvre: 5000 kr, øvre og nedre: 6500 kr)

Vipper/bryn:
- Farging og forming (550-650 kr)
- Brynsløft/Brow Lamination (840-890 kr)
- Vippeløft (840-1550 kr)
- Vokskurs (2900 kr)

Ansiktsbehandling:
- Signaturbehandling (1650 kr)
- Classic (1150 kr)
- Peeling Marine (1150 kr, 30min: 800 kr)
- Lunch-Behandling (880 kr)
- Ungdomsrens (600 kr)
- Classic med beroligende gummimaske (1300 kr)
- Hyalu-procollagene behandling (1495 kr)

Vippeextensions:
- Nytt sett (Klassisk: 1150 kr, Mixed: 1300 kr, Volum: 1500 kr, Megavolum: 1800 kr)
- Påfyll (500-1150 kr avhengig av type og varighet)
- Fjerning (500 kr)

Kroppsbehandling:
- Kroppspeeling (1000 kr)

Fotbehandling:
- Medisinsk/velvære (940 kr)
- Punktbehandling (300 kr)

Hårfjerning:
- Ansikt (overleppe: 260 kr, hake: 360 kr, hele: 450 kr)
- Brasiliansk (780 kr)
- Kroppsdeler (armer: 500 kr, bryst/rygg: 480 kr, legger: 500 kr, lår: 500 kr)
- Diverse vokspakker (1050-1400 kr)

Klassisk massasje:
- 30 min (600 kr)
- 60 min (1000 kr)
- 90 min (1500 kr)

Andre behandlinger:
- iPulse (5950 kr)

Din rolle er å:
1. Hjelpe kunder med produktanbefalinger
2. Svare presist på spørsmål om behandlinger og priser
3. Veilede om åpningstider, beliggenhet og kontaktinformasjon
4. Assistere med valg av riktige produkter og behandlinger

Analyse av kundeforespørsler:
- Direkte produktforespørsler (f.eks. "vis meg hudpleieprodukter")
- Indirekte behov (f.eks. "huden min er tørr" → trenger fuktighetskrem)
- Spørsmål om behandlinger og priser
- Merkevarer (spesielt Thalgo)

Svar alltid på norsk og vær hjelpsom med å forstå kundens behov.

For produktforespørsler, svar med "PRODUCT_REQUEST:" etterfulgt av relevante søkeord.
Eksempler:
- "Vis meg hudpleieprodukter" → "PRODUCT_REQUEST:hudpleie"
- "Jeg trenger en krem for tørr hud" → "PRODUCT_REQUEST:fuktighetskrem"
- "Har dere Thalgo produkter?" → "PRODUCT_REQUEST:thalgo"

For spørsmål om behandlinger, gi nøyaktig informasjon om tilgjengelige alternativer og priser fra listen over.

Hold alltid en profesjonell, men varm tone som reflekterer Seacret Spas høye servicestandard.`;

// Main handler function
export default async function handler(req, res) {
  if (!anthropic) {
    return res.status(500).json({
      success: false,
      error: 'API configuration error'
    });
  }

  try {
    const userMessage = req.body.messages[0]?.content || '';
    const sessionId = req.body.sessionId || 'default';

    // Get previously shown products for this session
    const previousProducts = shownProductsCache.get(sessionId) || [];

    // Direct product requests
    if (userMessage.toLowerCase().includes('vis meg') || 
        userMessage.toLowerCase().includes('produkt') ||
        userMessage.toLowerCase().includes('krem')) {
      const products = await searchProducts(userMessage, previousProducts);
      
      // Update shown products cache
      const productIds = products.map(p => p.id);
      shownProductsCache.set(sessionId, [...previousProducts, ...productIds]);

      return res.status(200).json({
        success: true,
        content: 'Her er noen produkter som kan passe for deg:',
        hasProductCard: true,
        products: products
      });
    }

    // Chat handling with Claude
    const completion = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    const response = completion.content[0].text;
    
    // Check if Claude identified a product request
    if (response.includes('PRODUCT_REQUEST:')) {
      const searchTerm = response.split('PRODUCT_REQUEST:')[1].trim();
      const products = await searchProducts(searchTerm, previousProducts);
      
      // Update shown products cache
      const productIds = products.map(p => p.id);
      shownProductsCache.set(sessionId, [...previousProducts, ...productIds]);

      return res.status(200).json({
        success: true,
        content: response.split('PRODUCT_REQUEST:')[0].trim(),
        hasProductCard: true,
        products: products
      });
    }

    return res.status(200).json({
      success: true,
      content: response
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}