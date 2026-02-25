/* SD Comayagua - Custom JS (limpio)
   Archivo mantenido por compatibilidad. Evita scripts externos y tracking.
*/

(function(){
  'use strict';

  // Hook opcional para botones "ir arriba"
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t) return;
    if(t.matches && t.matches('[data-scroll-top]')){
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

})();
