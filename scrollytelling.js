/* ==========================================================================
   SCROLLYTELLING.JS
   Anime .hero-pantalon depuis le hero jusqu'à ce qu'il s'encastre exactement
   dans .grid-target-case (la carte "Pantalon Signature" de la grille).

   Principe :
   1. On mesure la position/taille de départ (le hero) et d'arrivée (la carte).
   2. Pendant le scroll de .scrolly-track, l'image passe en position: fixed
      et on interpole top/left/width/height/border-radius entre ces deux
      rectangles, en fonction de la progression du scroll (0 → 1).
   3. À la fin, l'image "flottante" disparaît et la vraie image de la carte
      apparaît en fondu (classe .is-docked) → transition invisible.

   Sélecteurs à connaître pour vos remplacements :
     .hero-pantalon        → l'image qui voyage (changez la <img> à l'intérieur)
     .hero-pantalon-wrap   → conteneur qui réserve l'espace dans le hero
     .scrolly-track        → distance totale de scroll de l'animation
     .grid-target-case     → la carte produit qui reçoit l'image à la fin
   ========================================================================== */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    /* ---------------------------------------------------------------
       0. Header : passe en fond opaque après quelques pixels de scroll
    --------------------------------------------------------------- */
    var header = document.querySelector("[data-header]");
    if (header) {
      var toggleHeader = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 40);
      };
      toggleHeader();
      window.addEventListener("scroll", toggleHeader, { passive: true });
    }

    /* ---------------------------------------------------------------
       1. Vérifications préalables
    --------------------------------------------------------------- */
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
      console.warn("[scrollytelling] GSAP / ScrollTrigger introuvable — vérifiez les balises <script> CDN.");
      return;
    }

    var track   = document.querySelector("[data-scrolly-track]");   // .scrolly-track
    var pantalon = document.querySelector("[data-hero-pantalon]");   // .hero-pantalon
    var target  = document.querySelector("[data-grid-target]");     // .grid-target-case

    if (!track || !pantalon || !target) {
      // Une des pièces n'existe pas sur cette page (ex : page produit) → on sort proprement
      return;
    }

    // Respect de la préférence "réduire les animations"
    var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Sur mobile, la trajectoire "fixed" longue distance est peu lisible :
    // on désactive le vol de l'image et on se contente d'un fondu simple.
    var isMobile = window.matchMedia("(max-width: 900px)").matches;

    gsap.registerPlugin(ScrollTrigger);

    if (prefersReducedMotion || isMobile) {
      runSimpleFallback();
    } else {
      runFlyingAnimation();
    }

    /* ---------------------------------------------------------------
       2. Animation principale (desktop / tablette large)
    --------------------------------------------------------------- */
    function runFlyingAnimation() {
      var startRect, endRect, targetMedia;

      targetMedia = target.querySelector(".product-card__media img");

      // Capture les rectangles de départ (position naturelle du hero)
      // et d'arrivée (position de la carte produit dans la grille).
      function measure() {
        // On force l'image à revenir en flux normal le temps de mesurer,
        // pour ne pas mesurer sa propre position "fixed" précédente.
        var prevPosition = pantalon.style.position;
        pantalon.style.position = "absolute";
        pantalon.style.top = "0";
        pantalon.style.left = "0";

        startRect = pantalon.getBoundingClientRect();
        var wrapRect = pantalon.parentElement.getBoundingClientRect();
        // Position réelle du pantalon dans le document (pas juste le viewport)
        startRect = {
          top: wrapRect.top + window.scrollY,
          left: wrapRect.left + window.scrollX,
          width: wrapRect.width,
          height: wrapRect.height
        };

        pantalon.style.position = prevPosition;

        var tRect = target.getBoundingClientRect();
        endRect = {
          top: tRect.top + window.scrollY,
          left: tRect.left + window.scrollX,
          width: tRect.width,
          height: tRect.height
        };
      }

      measure();

      // Passage en position fixed dès le début du trajet
      gsap.set(pantalon, {
        position: "fixed",
        margin: 0,
        zIndex: 60
      });

      var st = ScrollTrigger.create({
        trigger: track,
        start: "top top",
        end: "bottom bottom",
        scrub: 1, // suit le scroll avec un léger amorti (fluidité)

        onUpdate: function (self) {
          var p = self.progress; // 0 → 1 sur toute la hauteur de .scrolly-track

          // Interpolation linéaire entre le rectangle de départ et d'arrivée.
          // Convertit les coordonnées "document" en coordonnées "viewport"
          // puisque l'élément est en position: fixed.
          var top    = gsap.utils.interpolate(startRect.top,    endRect.top,    p) - window.scrollY;
          var left   = gsap.utils.interpolate(startRect.left,   endRect.left,   p) - window.scrollX;
          var width  = gsap.utils.interpolate(startRect.width,  endRect.width,  p);
          var height = gsap.utils.interpolate(startRect.height, endRect.height, p);
          var radius = gsap.utils.interpolate(20, 12, p);
          var rotate = gsap.utils.interpolate(-4, 0, p); // légère bascule initiale

          gsap.set(pantalon, {
            top: top,
            left: left,
            width: width,
            height: height,
            borderRadius: radius,
            rotate: rotate
          });

          // Juste avant la fin : on fait apparaître l'image statique de la
          // carte pendant que l'image volante s'estompe, pour un raccord net.
          if (p > 0.92) {
            var fadeP = gsap.utils.mapRange(0.92, 1, 0, 1, p);
            gsap.set(pantalon, { opacity: 1 - fadeP });
            target.classList.toggle("is-docked", true);
            if (targetMedia) gsap.set(targetMedia, { opacity: fadeP });
          } else {
            gsap.set(pantalon, { opacity: 1 });
            target.classList.remove("is-docked");
            if (targetMedia) gsap.set(targetMedia, { opacity: 0 });
          }
        },

        onLeave: function () {
          // Le trajet est terminé : on masque définitivement l'image volante,
          // la carte produit affiche désormais sa propre image.
          gsap.set(pantalon, { opacity: 0, pointerEvents: "none" });
        },
        onEnterBack: function () {
          gsap.set(pantalon, { pointerEvents: "auto" });
        }
      });

      // Recalcule les rectangles si la fenêtre est redimensionnée
      // (breakpoints, rotation d'écran, etc.)
      window.addEventListener("resize", debounce(function () {
        measure();
        ScrollTrigger.refresh();
      }, 200));
    }

    /* ---------------------------------------------------------------
       3. Fallback simple (mobile / prefers-reduced-motion)
       Pas de vol d'image : léger fondu-échelle au moment où la carte
       cible entre dans le viewport.
    --------------------------------------------------------------- */
    function runSimpleFallback() {
      gsap.set(pantalon, { position: "static" });
      var targetMedia = target.querySelector(".product-card__media img");

      ScrollTrigger.create({
        trigger: target,
        start: "top 85%",
        onEnter: function () {
          target.classList.add("is-docked");
          if (targetMedia) gsap.fromTo(targetMedia, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" });
        }
      });
    }

    /* ---------------------------------------------------------------
       Utilitaire : debounce simple, sans dépendance
    --------------------------------------------------------------- */
    function debounce(fn, delay) {
      var timer;
      return function () {
        clearTimeout(timer);
        var args = arguments;
        var context = this;
        timer = setTimeout(function () { fn.apply(context, args); }, delay);
      };
    }
  }
})();
