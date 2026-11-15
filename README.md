# Web de la Importadora

Tienda estática (HTML/CSS/JS, sin servidor) con descuentos, packs, catálogo, carrito y pedido por WhatsApp (+51 924 895 094).

- `index.html` — tienda pública.
- `admin.html` — panel para agregar, editar, ocultar o eliminar productos y packs, y cambiar los datos del negocio (nombre, logo, textos, WhatsApp).
- `data.json` — catálogo y ajustes (lo edita el panel).

## Publicar gratis con GitHub Pages
1. En GitHub: **Settings → Pages → Deploy from a branch**, elige la rama `main` y carpeta `/ (root)`.
2. La web queda en `https://minispoter.github.io/Pagina/` y el panel en `.../admin.html`.

## Usar el panel
1. Crea un token: GitHub → Settings → Developer settings → **Fine-grained tokens** → solo el repositorio `Pagina`, permiso **Contents: Read and write**.
2. Abre `admin.html`, pega el token en "Conexión" y pulsa **Conectar y cargar**.
3. Agrega o edita productos → **Publicar en la web**. Las imágenes subidas se guardan en `images/`. La web se actualiza en 1–2 minutos.

Un producto con "Precio anterior" mayor al precio actual aparece en **Descuentos** con su % de descuento. El tipo **Pack** aparece en **Packs** con su lista de contenido.

El token solo se guarda en el navegador de quien lo usa; sin token nadie puede modificar el catálogo.
