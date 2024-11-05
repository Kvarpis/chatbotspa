// pages/api/chat.js
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Store shown products in memory
const shownProductsCache = new Map();

// Cache for Shopify metadata
let metadataCache = {
  data: null,
  lastFetched: null,
  timeout: 5 * 60 * 1000 // 5 minutes
};

// Cache for products
let productsCache = {
  data: null,
  lastFetched: null,
  timeout: 5 * 60 * 1000 // 5 minutes
};

// Fetch all relevant metadata from Shopify
async function fetchShopifyMetadata() {
  try {
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
    const accessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

    const query = `
      {
        collections(first: 25) {
          edges {
            node {
              id
              title
              handle
              description
              products(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        }
        products(first: 250) {
          edges {
            node {
              id
              title
              description
              handle
              availableForSale
              tags
              vendor
              productType
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
              collections(first: 5) {
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
    
    // Get all unique vendors, types, and tags
    const vendors = new Set();
    const productTypes = new Set();
    const tags = new Set();

    // Process and cache products
    productsCache.data = data.data?.products?.edges.map(edge => {
      const node = edge.node;
      const variant = node.variants.edges[0]?.node;

      if (node.vendor) vendors.add(node.vendor.toLowerCase());
      if (node.productType) productTypes.add(node.productType.toLowerCase());
      node.tags?.forEach(tag => tags.add(tag.toLowerCase()));
      
      return {
        id: node.id,
        title: node.title,
        description: node.description || '',
        handle: node.handle,
        vendor: node.vendor,
        productType: node.productType,
        tags: node.tags || [],
        featuredImage: node.featuredImage ? {
          url: node.featuredImage.url,
          altText: node.featuredImage.altText || node.title
        } : null,
        variants: node.variants,
        priceRange: {
          minVariantPrice: {
            amount: variant?.price?.amount || node.priceRange?.minVariantPrice?.amount || "0",
            currencyCode: variant?.price?.currencyCode || 'NOK'
          }
        },
        available: node.availableForSale,
        collections: node.collections
      };
    }) || [];
    productsCache.lastFetched = Date.now();

    // Get only collections that have products
    const collections = data.data?.collections?.edges
      .filter(edge => edge.node.products.edges.length > 0)
      .map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        description: edge.node.description
      })) || [];

    return {
      collections,
      searchTerms: {
        vendors: Array.from(vendors),
        productTypes: Array.from(productTypes),
        tags: Array.from(tags)
      }
    };
  } catch (error) {
    console.error('Error fetching Shopify metadata:', error);
    return {
      collections: [],
      searchTerms: {
        vendors: [],
        productTypes: [],
        tags: []
      }
    };
  }
}

// Function to get metadata with caching
async function getShopifyMetadata() {
  if (
    !metadataCache.data || 
    !metadataCache.lastFetched ||
    Date.now() - metadataCache.lastFetched > metadataCache.timeout
  ) {
    metadataCache.data = await fetchShopifyMetadata();
    metadataCache.lastFetched = Date.now();
  }
  return metadataCache.data;
}

// Get all products (using cache)
async function getAllProducts() {
  if (
    !productsCache.data || 
    !productsCache.lastFetched ||
    Date.now() - productsCache.lastFetched > productsCache.timeout
  ) {
    await fetchShopifyMetadata(); // This updates both metadata and products cache
  }
  return productsCache.data || [];
}

// Enhanced search function
async function searchProducts(searchTerm, previousProducts = []) {
  try {
    const [allProducts, metadata] = await Promise.all([
      getAllProducts(),
      getShopifyMetadata()
    ]);

    if (!allProducts || allProducts.length === 0) {
      console.error('No products found in store');
      return [];
    }

    const normalizedSearchTerm = searchTerm.toLowerCase().trim();
    
    // Score and filter products
    const scoredProducts = allProducts
      .filter(product => product.available)
      .map(product => {
        let score = 0;
        
        // Title match
        if (product.title.toLowerCase().includes(normalizedSearchTerm)) {
          score += 10;
        }
        
        // Description match
        if (product.description && 
            product.description.toLowerCase().includes(normalizedSearchTerm)) {
          score += 5;
        }
        
        // Vendor match (e.g., Thalgo)
        if (product.vendor && 
            product.vendor.toLowerCase().includes(normalizedSearchTerm)) {
          score += 15;
        }

        // Product type match
        if (product.productType && 
            product.productType.toLowerCase().includes(normalizedSearchTerm)) {
          score += 8;
        }

        // Tags match
        if (product.tags.some(tag => 
          tag.toLowerCase().includes(normalizedSearchTerm))) {
          score += 5;
        }

        // Collection match
        if (product.collections.edges.some(edge => 
          edge.node.title.toLowerCase().includes(normalizedSearchTerm) ||
          edge.node.handle.toLowerCase().includes(normalizedSearchTerm))) {
          score += 8;
        }

        return { ...product, relevanceScore: score };
      })
      .filter(product => product.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Filter out previously shown products
    const filteredProducts = scoredProducts
      .filter(product => !previousProducts.includes(product.id))
      .slice(0, 3);

    // If we don't have enough products, get random ones
    if (filteredProducts.length < 3) {
      const randomProducts = allProducts
        .filter(p => 
          p.available && 
          !previousProducts.includes(p.id) && 
          !filteredProducts.find(fp => fp.id === p.id)
        )
        .sort(() => Math.random() - 0.5)
        .slice(0, 3 - filteredProducts.length);

      return [...filteredProducts, ...randomProducts];
    }

    return filteredProducts;
  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

// Modified system prompt builder with complete Shopify data
async function buildSystemPrompt() {
  const metadata = await getShopifyMetadata();
  const collectionList = metadata.collections
    .map((col, index) => `${index + 1}. ${col.title}${col.description ? ` - ${col.description}` : ''}`)
    .join('\n');

  return `[Your existing system prompt with ${collectionList} inserted in PRODUKT KATEGORIER section]`;
}

// Main handler function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`
    });
  }

  if (!anthropic) {
    return res.status(500).json({
      success: false,
      error: 'API configuration error'
    });
  }

  try {
    const userMessage = req.body.messages[0]?.content || '';
    const sessionId = req.body.sessionId || 'default';
    const previousProducts = shownProductsCache.get(sessionId) || [];

    // Get current system prompt with updated categories
    const systemPrompt = await buildSystemPrompt();

    // Handle direct product requests
    if (await isProductRequest(userMessage)) {
      const products = await searchProducts(userMessage, previousProducts);
      
      if (products.length > 0) {
        const productIds = products.map(p => p.id);
        shownProductsCache.set(sessionId, [...previousProducts, ...productIds]);

        return res.status(200).json({
          success: true,
          content: 'Her er noen produkter som kan passe for deg:',
          hasProductCard: true,
          products: products
        });
      }
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
    
    // Handle product requests from Claude
    if (response.includes('PRODUCT_REQUEST:')) {
      const searchTerm = response.split('PRODUCT_REQUEST:')[1].trim();
      const products = await searchProducts(searchTerm, previousProducts);
      
      if (products.length > 0) {
        const productIds = products.map(p => p.id);
        shownProductsCache.set(sessionId, [...previousProducts, ...productIds]);

        return res.status(200).json({
          success: true,
          content: response.split('PRODUCT_REQUEST:')[0].trim(),
          hasProductCard: true,
          products: products
        });
      }
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

// Helper function to check if message is a product request using actual Shopify data
async function isProductRequest(message) {
  const metadata = await getShopifyMetadata();
  const normalizedMessage = message.toLowerCase();
  
  // Common action words in Norwegian
  const actionTerms = ['vis', 'se', 'kjøpe', 'bestille', 'flere'];
  
  // Check if message contains any action terms
  const hasActionTerm = actionTerms.some(term => normalizedMessage.includes(term));
  
  // Check if message contains any product-related terms from Shopify
  const hasProductTerm = [
    ...metadata.searchTerms.vendors,
    ...metadata.searchTerms.productTypes,
    ...metadata.searchTerms.tags
  ].some(term => normalizedMessage.includes(term.toLowerCase()));

  return hasActionTerm || hasProductTerm;
}

export const config = {
  api: {
    bodyParser: true,
    externalResolver: true,
  },
};

// Modified system prompt builder with complete Shopify data
async function buildSystemPrompt() {
  const metadata = await getShopifyMetadata();
  const collectionList = metadata.collections
    .map((col, index) => `${index + 1}. ${col.title}${col.description ? ` - ${col.description}` : ''}`)
    .join('\n');

  const systemPrompt = `
Du er en effektiv kundeservice-assistent for Seacret Spa, en eksklusiv spa- og velværeklinikk i Tønsberg.

REGLER:
1. Svar ALLTID kort og presist (maks 1-2 setninger)
2. For produkt-søk, bruk "PRODUCT_REQUEST:<søkeord>"
3. For bestilling, inkluder booking-lenke
4. Ved spørsmål om behandlinger, list opp i nummerert format

PRODUKT KATEGORIER:
${collectionList}

VIKTIG INFORMASJON OM SEACRET SPA:
- Beliggenhet: Gauterødveien 6b, 3154 Tolvsrød, Tønsberg (i underetasjen på Olsrød Park)
- Veibeskrivelse: 
  * Gå opp rulletrappen
  * Følg skiltingen til Seacret SPA
  * Like ved Level treningssenter
- Kontakt: 
  * Telefon: 91594152
  * E-post: runhild@cliniquer.no

BEHANDLINGERR:

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
const handler = async function(req, res) {
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

return systemPrompt;
}

// Helper function to check if message is a product request using actual Shopify data
async function isProductRequest(message) {
  const metadata = await getShopifyMetadata();
  const normalizedMessage = message.toLowerCase();
  
  // Common action words in Norwegian
  const actionTerms = ['vis', 'se', 'kjøpe', 'bestille', 'flere'];
  
  // Check if message contains any action terms
  const hasActionTerm = actionTerms.some(term => normalizedMessage.includes(term));
  
  // Check if message contains any product-related terms from Shopify
  const hasProductTerm = [
    ...metadata.searchTerms.vendors,
    ...metadata.searchTerms.productTypes,
    ...metadata.searchTerms.tags
  ].some(term => normalizedMessage.includes(term.toLowerCase()));

  return hasActionTerm || hasProductTerm;
}