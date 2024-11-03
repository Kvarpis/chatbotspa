(function() {
    const iframe = document.createElement('iframe');
    
    iframe.src = 'https://chatbotspa.vercel.app/embed';
    iframe.style.cssText = `
      position: fixed;
      bottom: 0;
      right: 0;
      width: 420px;
      height: 650px;
      border: 0;
      background: transparent;
      z-index: 999999;
    `;
    
    document.body.appendChild(iframe);
})();