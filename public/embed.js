(function() {
    // Configuration
    const config = {
        baseUrl: 'https://chatbotspa.vercel.app',
        buttonSize: '70px',
        expandedWidth: '420px',
        expandedHeight: '650px',
        position: {
            bottom: '20px',
            right: '20px'
        }
    };

    // Helper function to get cookies
    function getCookies() {
        const cookies = {};
        document.cookie.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            cookies[name] = value;
        });
        return cookies;
    }

    // Create and configure iframe
    const iframe = document.createElement('iframe');
    
    // Start with minimal size for just the chat button
    iframe.style.cssText = `
        position: fixed;
        bottom: ${config.position.bottom};
        right: ${config.position.right};
        width: ${config.buttonSize};
        height: ${config.buttonSize};
        border: 0;
        background: transparent;
        z-index: 999999;
        transition: all 0.3s ease;
        opacity: 0;
    `;
    
    // Set the source URL with session info
    const cookies = getCookies();
    const params = new URLSearchParams({
        cart: cookies.cart || '',
        shop_session: cookies._shopify_s || '',
        shop_domain: window.Shopify?.shop || ''
    });
    
    iframe.src = `${config.baseUrl}?${params.toString()}`;

    // Handle iframe load event
    iframe.onload = function() {
        iframe.style.opacity = '1';
        console.log('Chat widget loaded successfully');
        
        // Send initial session data
        iframe.contentWindow.postMessage({
            type: 'INIT_SESSION',
            cookies: getCookies(),
            shopifyData: {
                shop: window.Shopify?.shop,
                currency: window.Shopify?.currency?.active,
                cartToken: cookies.cart
            }
        }, config.baseUrl);
    };

    // Handle iframe error
    iframe.onerror = function(error) {
        console.error('Error loading chat widget:', error);
    };

    // Append iframe to body
    document.body.appendChild(iframe);

    // Listen for messages from the chat widget
    window.addEventListener('message', function(event) {
        if (event.origin === config.baseUrl) {
            console.log('Received message from chat:', event.data);
            
            if (event.data === 'expand') {
                iframe.style.width = config.expandedWidth;
                iframe.style.height = config.expandedHeight;
            } else if (event.data === 'minimize') {
                iframe.style.width = config.buttonSize;
                iframe.style.height = config.buttonSize;
            } else if (event.data?.type === 'REQUEST_SESSION') {
                // Send current session data when requested
                iframe.contentWindow.postMessage({
                    type: 'SESSION_UPDATE',
                    cookies: getCookies(),
                    shopifyData: {
                        shop: window.Shopify?.shop,
                        currency: window.Shopify?.currency?.active,
                        cartToken: cookies.cart
                    }
                }, config.baseUrl);
            }
        }
    });

    // Monitor cart cookie changes
    setInterval(() => {
        const currentCookies = getCookies();
        if (currentCookies.cart !== cookies.cart) {
            cookies.cart = currentCookies.cart;
            iframe.contentWindow.postMessage({
                type: 'CART_UPDATE',
                cartToken: currentCookies.cart
            }, config.baseUrl);
        }
    }, 1000);

    console.log('Chat widget initialized with session monitoring');
})();