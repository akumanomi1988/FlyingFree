# Privacidad, clima y modos de ejecución

## Geolocalización
La web no contiene una ubicación predeterminada del emisor. En la visita normal el navegador solo solicita la posición al pulsar «Entrar con clima local» o «Clima local». «Continuar sin ubicación» no consulta los datos geográficos, incluso si hubo un permiso previo. El modo TV y el modo emisión reutilizan un permiso previo sin provocar nuevas solicitudes; si no existe, el modo TV ofrece un botón de activación. El permiso se gestiona desde el navegador.

La aplicación transforma la latitud y la longitud a 0,1° antes de solicitar datos a Open-Meteo. Eso equivale a una cuadrícula aproximada, no a una dirección exacta. Nunca escribe las coordenadas en la interfaz, la URL, logs propios o localStorage. Mientras la página permanece abierta las coordenadas aproximadas permanecen temporalmente en memoria, para calcular la trayectoria solar y actualizar las condiciones actuales.

El proveedor meteorológico recibe la latitud/longitud aproximadas y la dirección IP de la conexión. Los usuarios pueden denegar el permiso. En ese caso el reloj sigue siendo real, pero el ciclo solar será aproximado y el clima quedará identificado como *simulado*. Si hay un error de red se conservan los datos solo mientras no superen el TTL de 90 minutos.

## Por espectador y por emisión
En GitHub Pages, cada navegador consulta sus propios datos autorizados. Una emisión unidireccional de OBS/YouTube reproduce la pantalla del emisor: el espectador no puede cambiar la meteorología de esos fotogramas, aunque sí podría abrir la web aparte.

## Servicio y licencia
Open-Meteo requiere atribución cuando se muestran sus datos y su API gratuita es no comercial. El uso comercial de la página con datos meteorológicos requiere revisión de licencia y cuotas. El despliegue masivo necesitará agregación/caché por cuadrícula, control de tasa y monitorización.

## Televisor
`?tv=1` activa un HUD de bajo contraste, con posición alternante cada ocho minutos para reducir el riesgo de marcado de paneles. No elimina por completo ese riesgo. Se deben respetar las funciones de suspensión y protección del fabricante. Algunos navegadores de Smart TV no ofrecen WebGL2 ni Geolocation; no se prometen compatibilidad o actualización meteorológica en todos los modelos.

## Seguridad
- No ejecutar JavaScript de respuestas externas; solo JSON validado de datos meteorológicos.
- Los números WMO se clasifican mediante una lista definida.
- HTTPs y `AbortController` con timeout de 8,5 segundos.
- No almacenar coordenadas ni registrar el contenido de URLs con geolocalización.
- Inyectar el fetch en pruebas para no efectuar solicitudes reales.
