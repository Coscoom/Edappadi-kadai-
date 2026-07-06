
      function bypassSplashScreen() {
        console.warn("Direct bypass invoked from independent fallback script!");
        try {
          const splash = document.getElementById('screen-splash');
          if (splash) splash.classList.remove('active');
          
          const home = document.getElementById('screen-home');
          if (home) {
            home.classList.add('active');
            if (typeof currentScreen !== 'undefined') {
              currentScreen = 'screen-home';
            }
          }
          
          const bottomNav = document.getElementById('app-bottom-nav');
          if (bottomNav) bottomNav.style.display = 'flex';
          
          if (typeof renderHomeScreen === 'function') {
            try { renderHomeScreen(); } catch (e) { console.error("renderHomeScreen failed:", e); }
          }
        } catch (e) {
          console.error("bypassSplashScreen failed:", e);
        }
      }
      
      setTimeout(function() {
        const skipBtn = document.getElementById('splash-skip-btn');
        if (skipBtn) {
          skipBtn.style.display = 'inline-block';
        }
      }, 2500);

      window.addEventListener('error', function(event) {
        try {
          const container = document.getElementById('splash-diagnostics');
          const text = document.getElementById('splash-diagnostics-text');
          if (container && text) {
            container.style.display = 'block';
            text.innerText = "Error: " + event.message + "\nLine: " + event.lineno + ":" + event.colno + "\nFile: " + (event.filename || "").split("/").pop();
          }
        } catch (ex) {}
      });
    