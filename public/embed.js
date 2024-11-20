(function() {
    // Configuration
    const config = {
        baseUrl: 'https://chatbotspa.vercel.app',
        buttonSize: {
            desktop: '70px',
            mobile: '56px'
        },
        expandedSize: {
            desktop: {
                width: '420px',
                height: '650px'
            },
            mobile: {
                width: '100%',
                height: '90vh'
            }
        },
        position: {
            desktop: {
                bottom: '25px',
                right: '25px'
            },
            mobile: {
                bottom: '0px',
                right: '0px'
            }
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

    // Helper function to check if device is mobile
    function isMobile() {
        return window.innerWidth <= 768;
    }

    // Function to update iframe size and position
    function updateIframeLayout() {
        const mobile = isMobile();
        
        if (iframe.dataset.state === 'expanded') {
            iframe.style.width = mobile ? config.expandedSize.mobile.width : config.expandedSize.desktop.width;
            iframe.style.height = mobile ? config.expandedSize.mobile.height : config.expandedSize.desktop.height;
            iframe.style.bottom = mobile ? config.position.mobile.bottom : config.position.desktop.bottom;
            iframe.style.right = mobile ? config.position.mobile.right : config.position.desktop.right;
        } else {
            iframe.style.width = mobile ? config.buttonSize.mobile : config.buttonSize.desktop;
            iframe.style.height = mobile ? config.buttonSize.mobile : config.buttonSize.desktop;
            iframe.style.bottom = mobile ? '16px' : config.position.desktop.bottom;
            iframe.style.right = mobile ? '16px' : config.position.desktop.right;
        }
    }

    // Function to update cart count UI
    function updateCartCountUI(count) {
        // Handle the main cart icon in header
        const cartIcons = document.querySelectorAll('.header__cart-icon, .cart-link, [data-cart-trigger], [data-cart-icon-bubble]');
        cartIcons.forEach(icon => {
            let bubble = icon.querySelector('.cart-count-bubble');
            if (!bubble) {
                bubble = document.createElement('div');
                bubble.className = 'cart-count-bubble';
                const span = document.createElement('span');
                span.setAttribute('aria-hidden', 'true');
                bubble.appendChild(span);
                icon.appendChild(bubble);
            }

            const span = bubble.querySelector('span');
            if (span) {
                span.textContent = count.toString();
            }

            bubble.style.display = count > 0 ? 'flex' : 'none';
            bubble.style.opacity = '1';
            bubble.style.visibility = 'visible';
        });

        // Update all cart count elements
        const cartCountElements = document.querySelectorAll([
            '.cart-count-bubble span',
            '.cart-count',
            '[data-cart-count]',
            '.js-cart-count',
            '[data-cart-item-count]',
            '.cart__count',
            '[data-cart-items-count]'
        ].join(','));
        
        cartCountElements.forEach(elem => {
            elem.textContent = count.toString();
            const bubble = elem.closest('.cart-count-bubble');
            if (bubble) {
                bubble.style.display = count > 0 ? 'flex' : 'none';
                bubble.style.opacity = '1';
                bubble.style.visibility = 'visible';
            }
        });

        // Dawn theme specific updates
        const dawnCartCount = document.querySelector('cart-icon-bubble');
        if (dawnCartCount) {
            dawnCartCount.setAttribute('data-cart-count', count.toString());
            if (count > 0) {
                dawnCartCount.classList.add('has-items');
                const dawnBubble = dawnCartCount.querySelector('.cart-count-bubble');
                if (dawnBubble) {
                    dawnBubble.style.display = 'flex';
                    dawnBubble.style.opacity = '1';
                }
            }
        }
    }

    // Enhanced cart update handler
    function handleCartUpdate(data, showDrawer = false) {
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

            updateCartCountUI(cartData.item_count);

            if (window.Shopify) {
                if (window.Shopify.onCartUpdate) {
                    window.Shopify.onCartUpdate(cartData);
                }

                if (window.Shopify.sections) {
                    document.documentElement.dispatchEvent(
                        new CustomEvent('cart:refresh', {
                            bubbles: true,
                            detail: { cart: cartData }
                        })
                    );
                }

                ['cart:update', 'cart:change', 'count:update'].forEach(eventName => {
                    document.documentElement.dispatchEvent(
                        new CustomEvent(eventName, {
                            bubbles: true,
                            detail: cartData
                        })
                    );
                });
            }

            if (showDrawer) {
                const cartDrawerTrigger = document.querySelector('[data-cart-drawer-trigger]');
                if (cartDrawerTrigger instanceof HTMLElement) {
                    cartDrawerTrigger.click();
                }
            }

            const currentCookies = getCookies();
            cookies.cart = currentCookies.cart;

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
    
    iframe.style.cssText = `
        position: fixed;
        border: 0;
        background: transparent;
        z-index: 999999;
        transition: all 0.3s ease;
        opacity: 0;
    `;
    
    iframe.dataset.state = 'minimized';
    
    // Initial layout setup
    updateIframeLayout();
    
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
        
        handleCartUpdate({}, false);
        
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
                    handleCartUpdate(event.data.data, false);
                    break;

                case 'REQUEST_SESSION':
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
                        handleCartUpdate({ action: 'add', data }, true);

                        iframe.contentWindow.postMessage({
                            type: 'ADD_TO_CART_SUCCESS',
                            data: data
                        }, config.baseUrl);
                    })
                    .catch(error => {
                        console.error('Error adding to cart:', error);
                        iframe.contentWindow.postMessage({
                            type: 'ADD_TO_CART_ERROR',
                            error: error.message
                        }, config.baseUrl);
                    });
                    break;

                default:
                    if (event.data === 'expand') {
                        iframe.dataset.state = 'expanded';
                        updateIframeLayout();
                    } else if (event.data === 'minimize') {
                        iframe.dataset.state = 'minimized';
                        updateIframeLayout();
                    }
            }
        }
    });

    // Add resize listener for responsive updates
    window.addEventListener('resize', updateIframeLayout);

    // Monitor cart cookie changes
    setInterval(() => {
        const currentCookies = getCookies();
        if (currentCookies.cart !== cookies.cart) {
            cookies.cart = currentCookies.cart;
            handleCartUpdate({ action: 'update' }, false);
        }
    }, 1000);

    console.log('Chat widget initialized with session monitoring');
})();