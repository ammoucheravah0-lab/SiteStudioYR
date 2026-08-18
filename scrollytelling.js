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

    // Fondu léger au chargement (pas de mouvement) : l'image est déjà en
    // place dès le premier pixel de la page. La descente / rotation /
    // rétrécissement est ENTIÈREMENT pilotée par le scroll ci-dessous —
    // aucune animation "auto-jouée" qui donnerait l'impression que le
    // pantalon est déjà arrivé avant même d'avoir scrollé.
    if (!prefersReducedMotion) {
      gsap.fromTo(pantalon, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" });
    }

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

      // Capture le rectangle de départ = le panneau .hero-pantalon-wrap
      // (plein-hauteur, collé à droite) et celui d'arrivée = la carte produit.
      // Le wrap est en position: absolute avec une taille propre (inset/width),
      // donc sa taille ne dépend pas de la position de la figure à l'intérieur
      // — inutile de "réinitialiser" la position avant de mesurer.
      function measure() {
        var wrapRect = pantalon.parentElement.getBoundingClientRect();
        startRect = {
          top: wrapRect.top + window.scrollY,
          left: wrapRect.left + window.scrollX,
          width: wrapRect.width,
          height: wrapRect.height
        };

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
        scrub: 0.35, // très réactif : suit le scroll quasi en temps réel (peu d'amorti)

        onUpdate: function (self) {
          var p = self.progress; // 0 → 1, en prise directe avec le scroll de l'utilisateur

          // Interpolation linéaire entre le rectangle de départ et d'arrivée.
          // Conversion "document" → "viewport" car l'élément est en position: fixed.
          var top    = gsap.utils.interpolate(startRect.top,    endRect.top,    p) - window.scrollY;
          var left   = gsap.utils.interpolate(startRect.left,   endRect.left,   p) - window.scrollX;
          var width  = gsap.utils.interpolate(startRect.width,  endRect.width,  p);
          var height = gsap.utils.interpolate(startRect.height, endRect.height, p);
          // Bords vifs au départ (panneau plein écran) → carte arrondie à l'arrivée
          var radius = gsap.utils.interpolate(0, 14, p);
          // ROTATION "tumbling" bien visible : 0° au départ, bascule à mi-parcours,
          // puis se redresse pile à l'arrivée dans la case produit (0° final).
          var rotate = Math.sin(p * Math.PI) * -16;

          gsap.set(pantalon, {
            top: top,
            left: left,
            width: width,
            height: height,
            borderRadius: radius,
            rotate: rotate
          });

          // Le dégradé du panneau plein-hauteur doit disparaître progressivement
          // dès que la carte commence à se détacher (sinon on verrait le
          // dégradé rétrécir avec l'image, ce qui casse l'effet).
          gsap.set(pantalon.parentElement, {
            "--fade-opacity": 1 - gsap.utils.clamp(0, 1, p / 0.25)
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
