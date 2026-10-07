/**
 * @license
 * SPDX-License-Identifier: Apache-2.0 AND LicenseRef-Commons-Clause-1.0
 *
 * The Library in Spanish: every theme's and every look's name and
 * description, by id.
 *
 * Apart from css-presets.js on purpose. That file is the looks — their
 * stylesheets, what they apply to — and it is copied onto layers; this is
 * only words about them, read by the Library screen when the dashboard
 * speaks Spanish. A look without an entry here shows its English, and the
 * smoke suite says so, so a new look cannot quietly ship in one language.
 *
 * Words a look draws on screen itself (REC, MOTION DETECTED) stay as they
 * are drawn; words it suggests typing are given in Spanish, since that is
 * what the stream speaks.
 */

export const THEMES_ES = {
  simonsays: { name: 'SimonSays predeterminado', hint: 'Negro plano y un solo color. El color sigue al acento del diseño, blanco si no hay ninguno, y cualquier pieza puede tener el suyo.' },
  cyberpunky: { name: 'Cyberpunky', hint: 'Un HUD de terminal en un solo color vivo: marcos de línea fina con cuadros en las esquinas, rayado de peligro, chips con muesca, títulos cuadrados y etiquetas pixeladas.' },
};

export const LOOKS_ES = {
  // ------------------------------------------------------------ Maratón
  'simonsays-omnibar': { name: 'Barra con etiqueta', hint: 'La etiqueta como celda rellena a la izquierda y el resto sobre negro, bajo un borde de color.' },
  'simonsays-tallbar': { name: 'Barra alta con etiqueta', hint: 'Para un omnibar alto: el cuadro de la etiqueta relleno con el color, la tarjeta como celda elevada, barras de meta y chips en el color, y el total sobre negro.' },
  'simonsays-runcard': { name: 'Panel del juego', hint: 'Negro con un borde de color arriba y abajo, y la categoría como chip relleno.' },
  'simonsays-nameplate': { name: 'Etiqueta de nombre', hint: 'Negro con una franja de color a la izquierda y la segunda línea como chip relleno.' },
  'simonsays-roster': { name: 'Asientos con etiqueta', hint: 'Cada asiento, una placa negra con el rol como pestaña rellena y los pronombres como chip. Quien presenta tiene un color propio; un asiento libre conserva su placa con la luz apagada.' },
  'simonsays-viewers': { name: 'Etiqueta de espectadores', hint: 'La marca en una celda rellena y la cifra sobre negro al lado.' },
  'simonsays-alert': { name: 'Alerta con franja', hint: 'Un panel negro con una franja del color a la izquierda, el nombre en el color y el mensaje al lado. Hecha en dos piezas para que un movimiento pueda armarla.' },
  'simonsays-countdown': { name: 'Cuenta regresiva grande', hint: 'La etiqueta como chip relleno sobre los dígitos, sobre negro bajo un borde de color.' },
  'simonsays-stopwatch': { name: 'Reloj de tiempos', hint: 'El cronómetro sobre el mismo negro que la cuenta regresiva: blanco mientras corre, gris en pausa y en el color cuando la partida termina.' },
  'simonsays-chat': { name: 'Chat con borde', hint: 'Filas planas con un borde de color y el nombre en el color. Aplicarlo cambia el tema del chat a Personalizado.' },
  'simonsays-images': { name: 'Imagen enmarcada', hint: 'Un panel negro con una línea fina por dentro del borde y el color en la parte de arriba, que mantiene la imagen separada de los bordes.' },
  'simonsays-title': { name: 'Título de pantalla', hint: 'Mayúsculas gruesas en el color, muy juntas, para las palabras grandes de una pantalla de inicio, de cierre o de pausa.' },
  'simonsays-chip': { name: 'Chip relleno', hint: 'Las palabras en una cajita rellena, para un número de pantalla, el nombre de una sección o un hashtag.' },
  'simonsays-goal': { name: 'Barra de fondos', hint: 'El porcentaje grande en el color, la etiqueta pequeña encima y una barra fina debajo.' },
  'simonsays-spotify': { name: 'Panel de canción', hint: 'Negro con un borde de color, la etiqueta como chip relleno y el progreso en el color.' },
  'simonsays-plan': { name: 'Guion del directo', hint: 'El encabezado como chip relleno, la línea en la que estás marcada en el color y las que ya pasaron atenuadas. Sin fondo propio: ponlo sobre un Panel negro.' },
  'simonsays-question': { name: 'Panel de pregunta', hint: 'Una tarjeta negra con el color por el borde y la etiqueta como chip relleno. Trae su propio fondo, ya que aparece sobre el juego.' },
  'simonsays-panel': { name: 'Panel negro', hint: 'El fondo sobre el que se construye una pantalla: negro, una línea fina por dentro del borde y un cuadrito en cada esquina.' },
  'simonsays-slab': { name: 'Bloque de color', hint: 'Un bloque sólido del color con una línea fina oscura por dentro, para el lateral o el pie de una pantalla.' },
  'simonsays-camera': { name: 'Marco de cámara', hint: 'Hueco, para una webcam: el color por la izquierda y más grueso en el pie, y un corchete arriba a la izquierda. Ponlo encima de la cámara.' },
  'simonsays-corners': { name: 'Esquinas de color', hint: 'Marca las esquinas en el color sin encerrar nada.' },
  'simonsays-avatar': { name: 'Avatar sobre negro', hint: 'El avatar sobre el panel negro, de pie sobre su base, con la línea fina encendida en el color mientras habla. Su texto es un chip relleno.' },
  'simonsays-avatar-slab': { name: 'Avatar sobre color', hint: 'El avatar sobre un bloque sólido del color, recortado con un borde negro para que un avatar vestido del mismo color siga destacando. Su texto es un chip negro arriba.' },
  'simonsays-avatar-cam': { name: 'Sustituto de cámara', hint: 'Para donde va la cámara cuando está apagada: negro con una cuadrícula tenue, el color por la izquierda y en el pie, y un cuadro que parpadea junto a su texto. Haz la capa del tamaño de la cámara.' },
  'simonsays-pngtuber': { name: 'Pegatina PNGtuber', hint: 'Tus imágenes recortadas con un borde negro y una sombra dura en el color, que salta más lejos mientras hablas.' },
  'simonsays-avatar-sticker': { name: 'Pegatina de avatar', hint: 'Sin caja: el avatar recortado con un borde negro y una sombra dura en el color, para una pantalla de inicio o una esquina del juego. Su texto va subrayado en el color.' },
  'simonsays-hypetrain': { name: 'Barra del Hype Train', hint: 'Negro con una línea fina, el nivel como chip en el color y una barra cuadrada que se llena en él. Al subir de nivel, el chip destella.' },
  'simonsays-shoutout': { name: 'Placa de shoutout', hint: 'Negro con una línea fina, una imagen cuadrada con borde del color, el nombre grande y el resto pequeño.' },
  'simonsays-giveaway': { name: 'Tarjeta de sorteo', hint: 'Negro con una línea fina, el título como chip en el color y el ganador grande en el color.' },
  'simonsays-leaderboard': { name: 'Tabla de posiciones', hint: 'Negro con una línea fina, imágenes cuadradas, el nivel como chip en el color y una barra fina y cuadrada. El primer puesto lleva borde del color.' },

  // ------------------------------------------------------------ Inspirado en Games Done Quick
  'cyber-omnibar': { name: 'Barra de terminal', hint: 'Una barra negra bajo una línea fina, la etiqueta como chip con muesca en el color principal y rayado de peligro al final.' },
  'cyber-tallbar': { name: 'Barra alta de terminal', hint: 'Para un omnibar alto: un bloque con muesca en el color principal que dice qué toca, una pista de línea fina con el resto rayado y el total grande y cuadrado.' },
  'cyber-header-draw': { name: 'Dibujar la cabecera', hint: 'La cabecera sube desde abajo como una línea tan ancha como su esquina cortada, luego se dibuja hacia la derecha, y el resto de la ranura sigue desde su borde. Para cualquiera de las barras Cyberpunky. Se repite en cada rotación.' },
  'cyber-card-draw': { name: 'Dibujar la tarjeta', hint: 'La tarjeta sube desde abajo como una línea y se dibuja hacia la derecha, y luego el chip de la categoría hace lo mismo desde su esquina cortada. Se repite cuando cambia el juego.' },
  'cyber-row-draw': { name: 'Dibujar la fila', hint: 'La fila sube desde abajo como una línea y se dibuja hacia la derecha, y la flecha se enciende al final. Se repite cuando cambia el nombre.' },
  'cyber-alert-draw': { name: 'Dibujar la alerta', hint: 'Cada línea de la alerta sube como una línea fina y se dibuja hacia la derecha — el mensaje y luego el nombre — y la línea de código detrás. Deja la salida de siempre como está.' },
  'cyber-line-draw': { name: 'Dibujar la línea', hint: 'Cada mensaje nuevo sube como una línea a la izquierda y se dibuja hacia la derecha. Aplicarlo cambia el tema del chat a Personalizado.' },
  'cyber-question-draw': { name: 'Dibujar la pregunta', hint: 'La tarjeta sube como una línea y se dibuja hacia la derecha, y luego el chip de la etiqueta hace lo mismo desde su esquina cortada. Se repite con cada pregunta que se pone.' },
  'cyber-runcard': { name: 'Cartucho', hint: 'Un marco de línea fina con un cuadro en cada esquina, el juego en mayúsculas cuadradas y la categoría como chip con muesca.' },
  'cyber-nameplate': { name: 'Fila de evento', hint: 'El nombre en mayúsculas cuadradas sobre una regla del color principal, la segunda línea en letra pixelada encima y una flecha al final: la lista de eventos de la referencia.' },
  'cyber-roster': { name: 'Tripulación', hint: 'Cada asiento, una caja de línea fina con el rol como pestaña del color principal, el nombre en mayúsculas cuadradas y los pronombres en letra pixelada. Un asiento libre conserva su caja con la luz apagada.' },
  'cyber-viewers': { name: 'Señal', hint: 'La marca en una caja entre corchetes y la cifra en letra pixelada.' },
  'cyber-alert': { name: 'Alerta con fallo', hint: 'El mensaje y el nombre apilados en mayúsculas cuadradas grandes — el mensaje en el color principal — con un desfase cromático en las letras y una línea de código de terminal debajo.' },
  'cyber-countdown': { name: 'Acceso pendiente', hint: 'Dígitos pixelados bajo una caja de estado con los extremos rayados, sobre negro en un marco de línea fina.' },
  'cyber-stopwatch': { name: 'Reloj de enlace', hint: 'El cronómetro en dígitos pixelados sobre una regla rayada: fijo mientras corre, atenuado en pausa y con la regla rellena del color principal cuando la partida termina.' },
  'cyber-chat': { name: 'Canal de terminal', hint: 'Líneas sobre oscuro con una línea fina debajo de cada una, los nombres en sus propios colores y letra cuadrada. Aplicarlo cambia el tema del chat a Personalizado.' },
  'cyber-images': { name: 'Visor', hint: 'La imagen en un marco de línea fina con un cuadro en cada esquina, separada de los bordes.' },
  'cyber-headline': { name: 'Titular', hint: 'Mayúsculas cuadradas grandes en el color principal, muy juntas: "EMPEZAMOS".' },
  'cyber-tag': { name: 'Etiqueta con muesca', hint: 'Las palabras en un chip pequeño del color principal con la esquina de arriba a la izquierda cortada: el "01" de la referencia.' },
  'cyber-status': { name: 'Caja de estado', hint: 'Letra pixelada en una caja de línea fina rayada en ambos extremos: el "CONNECTED" de la referencia.' },
  'cyber-goal': { name: 'Medidor de fondos', hint: 'El porcentaje enorme y cuadrado en el color principal, la etiqueta y las cifras en letra pixelada, y una pista fina rayada donde aún falta.' },
  'cyber-spotify': { name: 'Reproductor', hint: 'Una caja de línea fina con la etiqueta en letra pixelada, la canción en mayúsculas cuadradas y el progreso en el color principal, rayado por delante.' },
  'cyber-plan': { name: 'Registro de misión', hint: 'El encabezado en letra pixelada, la línea en la que estás en mayúsculas cuadradas con un cuadro al lado, y las hechas tachadas. Sin fondo propio: ponlo sobre un Panel HUD.' },
  'cyber-question': { name: 'Entrante', hint: 'Una tarjeta de línea fina con un cuadro en cada esquina, la etiqueta como chip con muesca y la pregunta en letra cuadrada. Trae su propio fondo, ya que aparece sobre el juego.' },
  'cyber-panel': { name: 'Panel HUD', hint: 'Negro con una cuadrícula tenue, una línea fina por dentro del borde y un cuadro en cada una de sus esquinas. El fondo sobre el que se construye una pantalla.' },
  'cyber-slab': { name: 'Bloque escalonado', hint: 'Un bloque sólido del color principal con un escalón cortado en la esquina de arriba a la izquierda, para el lateral o el pie de una pantalla.' },
  'cyber-hazard': { name: 'Rayado de peligro', hint: 'Rayado diagonal fino en el color principal, para el final de una barra o una franja que marca algo.' },
  'cyber-chevron': { name: 'Chevrón de esquina', hint: 'El doble corchete de la esquina de arriba a la derecha de la referencia, rayado en su brazo exterior. Hueco: ponlo sobre la esquina de un marco.' },

  // ------------------------------------------------------------ Reunión de emergencia
  'simonsays-players': { name: 'Jugadores sobre negro', hint: 'La lista de jugadores sobre el panel negro: el título como chip del color, cada jugador una celda oscura con un cuadrado de su color, y quien queda fuera atenuado con el motivo en el color.' },
  'simonsays-poll': { name: 'Encuesta sobre negro', hint: 'La encuesta sobre el panel negro: la pregunta en blanco, cada respuesta una celda oscura que se llena del color, su número como chip, y la ganadora con borde del color al cerrar.' },
  'simonsays-voice': { name: 'Llamada sobre negro', hint: 'La llamada de Discord como imágenes cuadradas con una línea fina, quien habla con borde del color y cada nombre como chip negro debajo de su imagen.' },
  'cyber-players': { name: 'Escaneo de jugadores', hint: 'Los jugadores como un escaneo: una caja de línea fina con un cuadrado en cada esquina, el título como chip con muesca y cada jugador una celda de línea fina con un cuadrado de su color. Quien queda fuera se oscurece, con el motivo en letra de píxel.' },
  'cyber-poll': { name: 'Enlace de encuesta', hint: 'La encuesta como un enlace: una caja de línea fina con un cuadrado en cada esquina, la pregunta en letra cuadrada, cada respuesta una celda de línea fina que se llena del color principal y los números en letra de píxel. La ganadora queda enmarcada en el color principal.' },
  'cyber-voice': { name: 'Comunicaciones', hint: 'La llamada de Discord como comunicaciones: imágenes cuadradas en cajas de línea fina, quien habla enmarcado en el color principal y cada nombre en letra de píxel.' },
  'cyber-avatar': { name: 'Operador', hint: 'El avatar en una caja de línea fina con un cuadrado en cada esquina y su texto como chip con muesca. La caja se enciende en el color principal mientras hablas.' },
  'cyber-pngtuber': { name: 'Holograma', hint: 'Tus imágenes como un holograma: recortadas con un brillo fino en el color principal que se intensifica mientras hablas.' },
  'cyber-hypetrain': { name: 'Sobrecarga', hint: 'El Hype Train como un medidor de sobrecarga: una caja de línea fina, el nivel como chip con muesca, una barra sólida en el color principal y el tiempo en letra de píxel.' },
  'cyber-shoutout': { name: 'Contacto', hint: 'Un shoutout como una tarjeta de contacto: una caja de línea fina con un cuadrado en cada esquina, la imagen cuadrada, el título como chip con muesca, el nombre en mayúsculas cuadradas y el juego en letra de píxel.' },
  'cyber-leaderboard': { name: 'Ranking', hint: 'La clasificación como una lectura de ranking: filas de línea fina, los puestos en letra de píxel, una barra sólida en el color principal y el primer puesto enmarcado en él.' },
  'cyber-giveaway': { name: 'Lotería', hint: 'Un sorteo como una terminal de lotería: una caja de línea fina con un cuadrado en cada esquina, el título como chip con muesca y los nombres pasando en letra de píxel grande.' },
};

/** A look's words in the dashboard's language: Spanish where there is some, English otherwise. */
export function lookWords(object, lang) {
  const es = lang === 'es' ? LOOKS_ES[object?.id] : null;
  return { name: es?.name || object?.name || '', hint: es?.hint || object?.hint || '' };
}

/** A theme's words likewise. */
export function themeWords(theme, lang) {
  const es = lang === 'es' ? THEMES_ES[theme?.id] : null;
  return { name: es?.name || theme?.name || '', hint: es?.hint || theme?.hint || '' };
}
