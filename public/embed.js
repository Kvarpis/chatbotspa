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

    // Helper function to handle cart updates
    function handleCartUpdate(data) {
        // Using the current window's fetch to maintain session
        fetch('/cart.js', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => response.json())
        .then(cartData => {
            console.log('Current cart data:', cartData);

            // Update cart count
            const cartCountElements = document.querySelectorAll('.cart-count-bubble span');
            cartCountElements.forEach(elem => {
                elem.textContent = cartData.item_count.toString();
            });

            // Update cart drawer if it exists
            if (window.Shopify && window.Shopify.onCartUpdate) {
                window.Shopify.onCartUpdate(cartData);
            }

            // Try to open cart drawer if it exists
            const cartDrawerTrigger = document.querySelector('[data-cart-drawer-trigger]');
            if (cartDrawerTrigger instanceof HTMLElement) {
                cartDrawerTrigger.click();
            }

            // Update the cookies object with new cart token
            const currentCookies = getCookies();
            cookies.cart = currentCookies.cart;

            // Send updated session to iframe
            iframe.contentWindow.postMessage({
                type: 'SESSION_UPDATE',
                cookies: currentCookies,
                shopifyData: {
                    shop: window.Shopify?.shop,
                    currency: window.Shopify?.currency?.active,
                    cartToken: currentCookies.cart
                }
            }, config.baseUrl);
        })
        .catch(error => {
            console.error('Error updating cart:', error);
        });
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
        shop_domain: window.location.hostname || window.Shopify?.shop || ''
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
                shop: window.location.hostname || window.Shopify?.shop,
                currency: window.Shopify?.currency?.active,
                cartToken: cookies.cart,
                cartUpdateUrl: window.location.origin + '/cart/add.js'
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
            
            switch(event.data?.type) {
                case 'CART_UPDATE':
                    console.log('Processing cart update:', event.data);
                    handleCartUpdate(event.data.data);
                    break;

                case 'REQUEST_SESSION':
                    // Send current session data when requested
                    iframe.contentWindow.postMessage({
                        type: 'SESSION_UPDATE',
                        cookies: getCookies(),
                        shopifyData: {
                            shop: window.location.hostname || window.Shopify?.shop,
                            currency: window.Shopify?.currency?.active,
                            cartToken: cookies.cart,
                            cartUpdateUrl: window.location.origin + '/cart/add.js'
                        }
                    }, config.baseUrl);
                    break;

                case 'ADD_TO_CART':
                    // Handle add to cart request from iframe
                    const { variantId, quantity } = event.data;
                    fetch('/cart/add.js', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            items: [{
                                id: variantId,
                                quantity: quantity
                            }]
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        console.log('Added to cart:', data);
                        handleCartUpdate({ action: 'add', data });
                    })
                    .catch(error => {
                        console.error('Error adding to cart:', error);
                    });
                    break;

                default:
                    // Handle expand/minimize
                    if (event.data === 'expand') {
                        iframe.style.width = config.expandedWidth;
                        iframe.style.height = config.expandedHeight;
                    } else if (event.data === 'minimize') {
                        iframe.style.width = config.buttonSize;
                        iframe.style.height = config.buttonSize;
                    }
            }
        }
    });

    // Monitor cart cookie changes
    setInterval(() => {
        const currentCookies = getCookies();
        if (currentCookies.cart !== cookies.cart) {
            cookies.cart = currentCookies.cart;
            handleCartUpdate({ action: 'update' });
        }
    }, 1000);

    console.log('Chat widget initialized with session monitoring');
})();