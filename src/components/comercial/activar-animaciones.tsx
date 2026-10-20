/**
 * Prende las animaciones de aparición, y pone la red que las atrapa si fallan.
 *
 * Es un `<script>` escrito a mano y no un `useEffect` porque **tiene que correr
 * antes de pintar**. Con un efecto de React, el primer cuadro sale con todo
 * visible y recién después se esconde: se ve un parpadeo de toda la página.
 *
 * Hace dos cosas, y la segunda es la que importa:
 *
 * 1. Pone `con-animaciones` en el `<html>`. El `opacity: 0` de `globals.css`
 *    vive adentro de esa clase, así que **esta línea es lo único que esconde
 *    algo**. Si el script no corre, la página se lee entera.
 *
 * 2. Arma la red: a los tres segundos muestra todo lo que siga pendiente. Vive
 *    acá, en JavaScript pelado, y no adentro de un componente, porque el caso
 *    que tiene que cubrir es justamente que React nunca llegue a montarse. Una
 *    red de seguridad que depende de lo mismo que está asegurando no asegura
 *    nada. `ObservadorRevelar` la cancela al montar, porque si React está vivo el
 *    observador se hace cargo y la red taparía las animaciones de todo lo que
 *    está más abajo.
 *
 * El componente no renderiza nada más que el script, así que se puede poner
 * arriba de todo en la página sin que ocupe lugar.
 */

const SCRIPT = `(function(){
  var d = document.documentElement;
  d.classList.add('con-animaciones');
  window.__redDeSeguridadAnimaciones = setTimeout(function () {
    var pendientes = d.querySelectorAll('[data-revelar="pendiente"]');
    for (var i = 0; i < pendientes.length; i++) {
      pendientes[i].setAttribute('data-revelar', 'visto');
    }
  }, 3000);
})();`;

export function ActivarAnimaciones() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
