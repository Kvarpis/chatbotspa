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

    // Enhanced cart update handler
    function handleCartUpdate(data) {
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

            // Update all possible cart count elements
            const cartCountElements = document.querySelectorAll([
                '.cart-count-bubble span',
                '.cart-count',
                '[data-cart-count]',
                '.js-cart-count',
                '[data-cart-item-count]'
            ].join(','));
            
            cartCountElements.forEach(elem => {
                elem.textContent = cartData.item_count.toString();
            });

            // Trigger various cart update events
            if (window.Shopify) {
                // Standard Shopify cart update
                if (window.Shopify.onCartUpdate) {
                    window.Shopify.onCartUpdate(cartData);
                }

                // Trigger cart refresh event
                document.documentElement.dispatchEvent(
                    new CustomEvent('cart:refresh', {
                        bubbles: true
                    })
                );

                // Additional cart update event
                document.documentElement.dispatchEvent(
                    new CustomEvent('cart:update', {
                        bubbles: true,
                        detail: cartData
                    })
                );
            }

            // Try to open cart drawer using various selectors
            const cartDrawerTriggers = [
                '[data-cart-drawer-trigger]',
                '[data-drawer-toggle="cart"]',
                '.js-drawer-open-cart',
                '[data-action="open-drawer"][data-drawer="cart"]'
            ];

            for (const selector of cartDrawerTriggers) {
                const trigger = document.querySelector(selector);
                if (trigger instanceof HTMLElement) {
                    trigger.click();
                    break;
                }
            }

            // Update cart drawer visibility
            const cartDrawer = document.querySelector([
                '#cart-drawer',
                '.cart-drawer',
                '.js-cart-drawer',
                '[data-drawer="cart"]'
            ].join(','));

            if (cartDrawer) {
                cartDrawer.classList.add('is-active', 'is-visible', 'drawer--is-open');
                document.body.classList.add('cart-drawer-open');
            }

            // Update cookies and session
            const currentCookies = getCookies();
            cookies.cart = currentCookies.cart;

            // Send updated session to iframe
            iframe.contentWindow.postMessage({
                type: 'SESSION_UPDATE',
                cookies: currentCookies,
                shopifyData: {
                    shop: window.location.hostname || window.Shopify?.shop,
                    currency: window.Shopify?.currency?.active,
                    cartToken: currentCookies.cart,
                    cartCount: cartData.item_count
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

                        // Send success message back to iframe
                        iframe.contentWindow.postMessage({
                            type: 'ADD_TO_CART_SUCCESS',
                            data: data
                        }, config.baseUrl);
                    })
                    .catch(error => {
                        console.error('Error adding to cart:', error);
                        // Send error message back to iframe
                        iframe.contentWindow.postMessage({
                            type: 'ADD_TO_CART_ERROR',
                            error: error.message
                        }, config.baseUrl);
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