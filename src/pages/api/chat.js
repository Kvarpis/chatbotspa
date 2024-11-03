// pages/api/chat.js
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Enhanced fuzzy search with language-aware matching
function fuzzyMatch(str1, str2) {
  const normalize = (str) => str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9\s]/g, ''); // Remove special characters

  const s1 = normalize(str1);
  const s2 = normalize(str2);
  
  // Check for exact matches first
  if (s1 === s2) return true;
  
  // Check for substring matches
  if (s1.includes(s2) || s2.includes(s1)) return true;
  
  // Check for word-level matches
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (levenshteinDistance(word1, word2) <= Math.min(2, Math.floor(word1.length * 0.3))) {
        return true;
      }
    }
  }
  
  return false;
}

// Improved Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
    
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  
  return track[str2.length][str1.length];
}

// Enhanced product categories with synonyms and common misspellings
const productCategories = {
  'hudpleie': ['face', 'facial', 'skin care', 'skincare', 'hudkrem', 'krem', 'cream', 'lotion', 'ansikt', 'ansiktskrem'],
  'kropp': ['body', 'massage', 'kroppspleie', 'body lotion', 'body cream', 'kroppskrem'],
  'thalgo': ['thalgo', 'talgo', 'thalgo products', 'thalgo behandling'],
  'gave': ['gift', 'present', 'gavekort', 'gaveesker', 'gavesett'],
  'behandling': ['treatment', 'therapy', 'spa', 'massage', 'massasje', 'behandlinger']
};

// Normalize and prepare search terms
function normalizeSearchTerm(term) {
  return term.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Enhanced product search function
async function searchProducts(searchTerm, previousProducts = []) {
  try {
    const allProducts = await getAllProducts();
    if (!allProducts || allProducts.length === 0) {
      console.error('No products found in store');
      return [];
    }

    // If no specific search term, return random available products
    if (!searchTerm || 
        searchTerm.toLowerCase().includes('produkter') || 
        searchTerm.toLowerCase().includes('vis meg')) {
      return getRandomProducts(allProducts, 3, previousProducts);
    }

    const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
    
    // Score and rank products based on relevance
    const scoredProducts = allProducts
      .filter(product => product.available)
      .map(product => {
        let score = 0;
        
        // Check title match
        if (fuzzyMatch(product.title, normalizedSearchTerm)) score += 10;
        
        // Check description match
        if (product.description && fuzzyMatch(product.description, normalizedSearchTerm)) score += 5;
        
        // Check category matches
        for (const [ keywords] of Object.entries(productCategories)) {
          if (keywords.some(keyword => fuzzyMatch(keyword, normalizedSearchTerm))) {
            score += 8;
          }
        }
        
        return { ...product, relevanceScore: score };
      })
      .filter(product => product.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Filter out previously shown products
    const newProducts = scoredProducts
      .filter(product => !previousProducts.includes(product.id))
      .slice(0, 3);

    // If we don't have enough new products, get random ones
    if (newProducts.length < 3) {
      const additionalProducts = getRandomProducts(
        allProducts.filter(p => !previousProducts.includes(p.id) && 
                               !newProducts.find(np => np.id === p.id)),
        3 - newProducts.length
      );
      return [...newProducts, ...additionalProducts];
    }

    return newProducts;
  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

// Get random products helper
function getRandomProducts(products, count, excludeIds = []) {
  return products
    .filter(p => p.available && !excludeIds.includes(p.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

// Fetch all products from Shopify
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
              collections(first: 5) {
                edges {
                  node {
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
    
    if (data.errors) {
      console.error('Shopify GraphQL Errors:', data.errors);
      return [];
    }

    return (data.data?.products?.edges || []).map(edge => {
      const node = edge.node;
      const variant = node.variants.edges[0]?.node;
      
      return {
        id: node.id,
        title: node.title,
        description: node.description || '',
        handle: node.handle,
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
        available: node.availableForSale
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
You are a helpful shopping assistant for Seacret Spa, en eksklusiv spa- og velværeklinikk i Tønsberg. 

VIKTIG INFORMASJON OM SEACRET SPA:
- Beliggenhet: Gauterødveien 6b, 3154 Tolvsrød, Tønsberg (i underetasjen på Olsrød Park)
- Veibeskrivelse: 
  * Gå opp rulletrappen
  * Følg skiltingen til Seacret SPA
  * Like ved Level treningssenter
- Kontakt: 
  * Telefon: 91594152
  * E-post: runhild@cliniquer.no

BEHANDLINGER VI TILBYR:

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