// File: pages/api/chat.js

import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Enhanced caching with type definitions
const caches = {
  metadata: {
    data: null,
    lastFetched: null,
    timeout: 5 * 60 * 1000 // 5 minutes
  },
  products: {
    data: null,
    lastFetched: null,
    timeout: 5 * 60 * 1000
  }
};

// Store shown products per session
const shownProductsCache = new Map();

// Enhanced product categories with semantic categorization
const productCategories = {
  'ansikt': ['ansiktspleie', 'face', 'facial', 'ansiktskrem', 'rens', 'serum', 'mask'],
  'kropp': ['kroppspleie', 'body', 'body lotion', 'massasje', 'peeling'],
  'thalgo': ['thalgo products', 'havpleie', 'marine', 'alger'],
  'anti-age': ['anti-aging', 'rynker', 'anti-wrinkle', 'aldring', 'lifting'],
  'fukt': ['hydrating', 'moisture', 'tørr hud', 'fuktighet', 'fuktighetskrem'],
  'sensitiv': ['sensitive', 'følsom hud', 'rolig', 'beroligende'],
  'acne': ['problemhud', 'uren hud', 'spots', 'akneplager']
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
    
    // Enhanced metadata processing
    const vendors = new Set();
    const productTypes = new Set();
    const tags = new Set();

    // Process and categorize products
    const products = data.data?.products?.edges.map(edge => {
      const node = edge.node;
      const variant = node.variants.edges[0]?.node;

      // Track metadata
      if (node.vendor) vendors.add(node.vendor.toLowerCase());
      if (node.productType) productTypes.add(node.productType.toLowerCase());
      node.tags?.forEach(tag => tags.add(tag.toLowerCase()));

      // Add category matching
      const categories = Object.entries(productCategories)
        .filter(([_, keywords]) =>
          keywords.some(keyword =>
            node.title.toLowerCase().includes(keyword) ||
            node.description?.toLowerCase().includes(keyword) ||
            node.tags?.some(tag => tag.toLowerCase().includes(keyword))
          )
        )
        .map(([category]) => category);
      
      return {
        id: node.id,
        title: node.title,
        description: node.description || '',
        handle: node.handle,
        vendor: node.vendor,
        productType: node.productType,
        tags: node.tags || [],
        categories,
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

    // Cache the products
    caches.products.data = products;
    caches.products.lastFetched = Date.now();

    // Get collections with products
    const collections = data.data?.collections?.edges
      .filter(edge => edge.node.products.edges.length > 0)
      .map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        description: edge.node.description
      })) || [];

    const metadata = {
      collections,
      searchTerms: {
        vendors: Array.from(vendors),
        productTypes: Array.from(productTypes),
        tags: Array.from(tags)
      }
    };

    caches.metadata.data = metadata;
    caches.metadata.lastFetched = Date.now();

    return metadata;
  } catch (error) {
    console.error('Error fetching Shopify metadata:', error);
    throw error;
  }
}

// Get metadata with caching
async function getShopifyMetadata() {
  if (
    !caches.metadata.data || 
    !caches.metadata.lastFetched ||
    Date.now() - caches.metadata.lastFetched > caches.metadata.timeout
  ) {
    await fetchShopifyMetadata();
  }
  return caches.metadata.data;
}

// Get all products with caching
async function getAllProducts() {
  if (
    !caches.products.data || 
    !caches.products.lastFetched ||
    Date.now() - caches.products.lastFetched > caches.products.timeout
  ) {
    await fetchShopifyMetadata();
  }
  return caches.products.data || [];
}

// Get random products helper
function getRandomProducts(products, previousProducts, count = 3) {
  return products
    .filter(p => p.available && !previousProducts.includes(p.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

// Enhanced search function
async function searchProducts(searchTerm, previousProducts = []) {
  try {
    const allProducts = await getAllProducts();
    
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
        
        // Direct matches
        if (product.title.toLowerCase().includes(normalizedSearchTerm)) score += 10;
        if (product.description?.toLowerCase().includes(normalizedSearchTerm)) score += 5;
        if (product.vendor?.toLowerCase().includes(normalizedSearchTerm)) score += 15;
        if (product.productType?.toLowerCase().includes(normalizedSearchTerm)) score += 8;
        
        // Category matches
        product.categories?.forEach(category => {
          if (normalizedSearchTerm.includes(category)) score += 15;
          if (productCategories[category]?.some(keyword => 
            normalizedSearchTerm.includes(keyword)
          )) score += 10;
        });

        // Tag matches
        product.tags?.forEach(tag => {
          if (tag.toLowerCase().includes(normalizedSearchTerm)) score += 5;
        });

        // Collection matches
        product.collections.edges.forEach(edge => {
          if (edge.node.title.toLowerCase().includes(normalizedSearchTerm)) score += 8;
        });

        return { ...product, relevanceScore: score };
      })
      .filter(product => 
        product.relevanceScore > 0 && 
        !previousProducts.includes(product.id)
      )
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Get top 3 matches or random products
    return scoredProducts.length > 0 
      ? scoredProducts.slice(0, 3)
      : getRandomProducts(allProducts, previousProducts);
  } catch (error) {
    console.error('Product search error:', error);
    return [];
  }
}

// Enhanced product request detection with better context awareness
async function isProductRequest(message) {
  const metadata = await getShopifyMetadata();
  const normalizedMessage = message.toLowerCase();
  
  // Booking/appointment related terms (should NOT trigger product search)
  const bookingTerms = [
    'bestill', 'time', 'booking', 'avtale', 'behandling', 
    'time', 'behandlinger', 'massasje', 'vipper', 'bryn',
    'konsultasjon', 'dermapen', 'voks', 'voksing'
  ];

  // If message contains booking terms, it's not a product request
  if (bookingTerms.some(term => normalizedMessage.includes(term))) {
    return false;
  }

  // Action terms specifically for products
  const productActionTerms = [
    'vis meg', 'se på', 'kjøpe', 'produkter', 'krem',
    'anbefal', 'handle', 'shopping', 'nettbutikk', 'kjøpe'
  ];
  
  // Check for product action terms
  const hasProductAction = productActionTerms.some(term => 
    normalizedMessage.includes(term)
  );
  
  // Check for specific product-related terms from Shopify
  const hasProductTerm = [
    ...metadata.searchTerms.vendors,
    ...metadata.searchTerms.productTypes,
    ...metadata.searchTerms.tags,
    ...Object.keys(productCategories),
    ...Object.values(productCategories).flat()
  ].some(term => normalizedMessage.includes(term.toLowerCase()));

  // Only return true if we have both a product action and a product term
  // or if it's a very specific product reference
  return (hasProductAction && hasProductTerm) || 
         normalizedMessage.includes('thalgo') ||
         /\b(serum|krem|lotion|rens|maske)\b/.test(normalizedMessage);
}

// System prompt builder
async function buildSystemPrompt() {
  const metadata = await getShopifyMetadata();
  const collectionList = metadata.collections
    .map((col, index) => `${index + 1}. ${col.title}${col.description ? ` - ${col.description}` : ''}`)
    .join('\n');

    return `
    Du er en effektiv kundeservice-assistent for Seacret Spa, en eksklusiv spa- og velværeklinikk i Tønsberg.
    
    REGLER:
    1. Svar ALLTID kort og presist (maks 1-2 setninger)
    2. For produkt-søk, bruk "PRODUCT_REQUEST:<søkeord>"
    3. For bestilling, inkluder booking-lenke: https://bestill.timma.no/reservation/SeacretSpa
    4. Ved spørsmål om behandlinger, list opp i nummerert format
    5. Ved spørsmål om priser, oppgi ALLTID eksakt pris fra prislisten
    6. Ved indirekte produktspørsmål, spør om mer informasjon for å gi best mulig anbefaling
    
    PRODUKT KATEGORIER OG SØKEORD:
    ${collectionList}
    
    HOVEDKATEGORIER:
    - Ansiktspleie: krem, serum, rens, mask, toner
    - Kroppspleie: body lotion, peeling, massasjeolje
    - Thalgo: havmineraler, alger, marin
    - Anti-age: rynker, aldring, fasthet, lifting
    - Spesialpleie: sensitiv, acne, rosacea, pigmentering
    - Solpleie: solkrem, after sun, beskyttelse
    
    VIKTIG INFORMASJON OM SEACRET SPA:
    - Beliggenhet: Gauterødveien 6b, 3154 Tolvsrød, Tønsberg (i underetasjen på Olsrød Park)
    - Veibeskrivelse: 
      * Gå opp rulletrappen
      * Følg skiltingen til Seacret SPA
      * Like ved Level treningssenter
    - Kontakt: 
      * Telefon: 91594152
      * E-post: runhild@cliniquer.no
    - Bestilling: https://bestill.timma.no/reservation/SeacretSpa
    
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
    
    SPØRSMÅLSHÅNDTERING:
    
    For produktspørsmål:
    - Ved direkte spørsmål: Bruk "PRODUCT_REQUEST:" med relevante søkeord
    - Ved indirekte behov: Still oppfølgingsspørsmål om hudtype/bekymringer
    - For Thalgo-produkter: Fremhev marine ingredienser og spa-opplevelsen
    
    For behandlingsspørsmål:
    - Oppgi alltid nøyaktig pris
    - Forklar kort hva behandlingen innebærer
    - Henvis til booking-lenken for timebestilling
    
    Din rolle er å:
    1. Hjelpe kunder med produktanbefalinger
    2. Svare presist på spørsmål om behandlinger og priser
    3. Veilede om åpningstider, beliggenhet og kontaktinformasjon
    4. Assistere med valg av riktige produkter og behandlinger
    
    PRODUKT REQUESTS - EKSEMPLER:
    - "Vis meg hudpleieprodukter" → "PRODUCT_REQUEST:hudpleie"
    - "Jeg trenger en krem for tørr hud" → "PRODUCT_REQUEST:fuktighetskrem"
    - "Har dere Thalgo produkter?" → "PRODUCT_REQUEST:thalgo"
    - "Noe for sensitiv hud" → "PRODUCT_REQUEST:sensitiv"
    - "Anti-aging produkter" → "PRODUCT_REQUEST:anti-age"
    - "Kroppsprodukter" → "PRODUCT_REQUEST:kroppspleie"
    
    RESPONSMAL:
    - For produktsøk: "La meg vise deg noen produkter som kan passe for deg. PRODUCT_REQUEST:[søkeord]"
    - For behandlinger: "Her er behandlingen(e) som passer ditt behov: [behandling + pris]"
    - For timebestilling: "Du kan bestille time her: https://bestill.timma.no/reservation/SeacretSpa"
    
    Hold alltid en profesjonell, men varm tone som reflekterer Seacret Spas høye servicestandard.`;
}

// Add this right before the handler
const createBookingComponent = () => {
  return {
    text: 'Bestill time hos oss',
    url: 'https://bestill.timma.no/reservation/SeacretSpa'
  };
};

// Main handler function with improved context handling
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

    // Get system prompt with updated categories
    const systemPrompt = await buildSystemPrompt();

    // Booking-related terms check
    const bookingTerms = ['bestill', 'time', 'booking', 'avtale', 'behandling'];
    const isBookingRequest = bookingTerms.some(term => 
      userMessage.toLowerCase().includes(term)
    );

    // Handle booking requests immediately
    if (isBookingRequest) {
      const bookingComponent = createBookingComponent();
      return res.status(200).json({
        success: true,
        content: 'Du kan bestille time direkte her:',
        hasBookingButton: true,
        booking: bookingComponent
      });
    }

    // Handle direct product requests with improved detection
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

    // Regular chat handling with Claude
    const completion = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    });

    const response = completion.content[0].text;
    
    // Check if response indicates a booking request
    if (response.toLowerCase().includes('bestill') || 
        response.toLowerCase().includes('booking') ||
        response.toLowerCase().includes('time')) {
      const bookingComponent = createBookingComponent();
      return res.status(200).json({
        success: true,
        content: response,
        hasBookingButton: true,
        booking: bookingComponent
      });
    }
    
    // Handle product requests from Claude
    if (response.includes('PRODUCT_REQUEST:') && !isBookingRequest) {
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

export const config = {
  api: {
    bodyParser: true,
    externalResolver: true,
  },
};