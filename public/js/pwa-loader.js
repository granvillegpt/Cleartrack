(function() {
  'use strict';

  const allowedHosts = new Set([
    'app.cleartrack.co.za',
    'localhost',
    '127.0.0.1'
  ]);

  if (!allowedHosts.has(window.location.hostname)) {
    return;
  }

  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) {
    return;
  }

  const ensureInHead = (selector, factory) => {
    if (!head.querySelector(selector)) {
      head.appendChild(factory());
    }
  };

  const addMeta = (name, content) => {
    ensureInHead(`meta[name="${name}"]`, () => {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      return meta;
    });
  };

  const addLink = (rel, href, attributes = {}) => {
    const attrSelector = Object.entries(attributes)
      .map(([key, value]) => `[${key}="${value}"]`)
      .join('');
    ensureInHead(`link[rel="${rel}"][href="${href}"]${attrSelector}`, () => {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      Object.entries(attributes).forEach(([key, value]) => {
        link.setAttribute(key, value);
      });
      return link;
    });
  };

  const preconnectTargets = [
    'https://www.gstatic.com',
    'https://firestore.googleapis.com',
    'https://firebase.googleapis.com'
  ];

  preconnectTargets.forEach((href) => {
    addLink('preconnect', href, { crossOrigin: 'anonymous' });
    addLink('dns-prefetch', href);
  });

  addLink('manifest', '/manifest.json');
  addMeta('theme-color', '#0b7285');

  const metaTags = [
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'ClearTrack' },
    { name: 'mobile-web-app-capable', content: 'yes' }
  ];

  metaTags.forEach(({ name, content }) => addMeta(name, content));

  const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
  iconSizes.forEach((size) => {
    addLink(
      'apple-touch-icon',
      `/icons/cleartrack-${size}.png?v=3`,
      { sizes: `${size}x${size}` }
    );
  });

  const splashScreens = [
    { media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)', href: '/splash/splash-iphone-se.png' },
    { media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)', href: '/splash/splash-iphone-se.png' },
    { media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)', href: '/splash/splash-iphone-xr.png' },
    { media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)', href: '/splash/splash-iphone-xs.png' },
    { media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)', href: '/splash/splash-iphone-12.png' },
    { media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)', href: '/splash/splash-iphone-14-pro.png' },
    { media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)', href: '/splash/splash-iphone-8-plus.png' },
    { media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)', href: '/splash/splash-iphone-xs-max.png' },
    { media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)', href: '/splash/splash-iphone-12-pro-max.png' },
    { media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)', href: '/splash/splash-iphone-14-pro-max.png' },
    { media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)', href: '/splash/splash-ipad-mini.png' },
    { media: '(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2)', href: '/splash/splash-ipad.png' },
    { media: '(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2)', href: '/splash/splash-ipad-air.png' },
    { media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)', href: '/splash/splash-ipad-pro-11.png' },
    { media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)', href: '/splash/splash-ipad-pro-12.png' }
  ];

  splashScreens.forEach(({ media, href }) => {
    ensureInHead(`link[rel="apple-touch-startup-image"][media="${media}"]`, () => {
      const link = document.createElement('link');
      link.rel = 'apple-touch-startup-image';
      link.media = media;
      link.href = href;
      return link;
    });
  });

  if ('serviceWorker' in navigator && !document.querySelector('script[data-sw-register="true"]')) {
    const swScript = document.createElement('script');
    swScript.src = '/sw-register.js';
    swScript.defer = true;
    swScript.dataset.swRegister = 'true';
    head.appendChild(swScript);
  }
})();
