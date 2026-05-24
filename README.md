# 🎬 VideoCanvas

> A local, privacy-first visual organizer for videos and images — no servers, no uploads, no tracking.  
> Organizador visual de videos e imágenes — sin servidores, sin subidas, sin rastreo.

<br>

## ✨ About / Sobre el proyecto

**[English]**  
VideoCanvas is a browser-based tool for visually organizing, tagging, renaming, and sorting **videos and images** (jpg, png, webp, gif) directly from your local machine. Everything runs in your browser — your files never leave your computer.

Built by **Nano Ovalle** ([@nano.ovalle](https://www.instagram.com/nano.ovalle/)) as a practical tool for video creators and editors who need to manage large collections of clips and references before jumping into a timeline.

**[Español]**  
VideoCanvas es una herramienta que corre en el navegador para organizar visualmente, etiquetar, renombrar y ordenar **videos e imágenes** (jpg, png, webp, gif) directamente desde tu máquina local. Todo se ejecuta en el navegador — tus archivos nunca salen de tu computadora.

Creado por **Nano Ovalle** ([@nano.ovalle](https://www.instagram.com/nano.ovalle/)) como herramienta práctica para creadores y editores que necesitan organizar grandes colecciones de clips y referencias antes de armar un timeline.

<br>

## 🚀 Getting Started / Cómo usar

**[English]**

1. Clone or download this repository
2. Open `index.html` directly in your browser (no server needed)
3. Click **"Load folder"** or drag a folder onto the canvas
4. Start organizing!

```bash
git clone https://github.com/YOUR_USERNAME/videocanvas.git
cd videocanvas
# open index.html in your browser
```

**[Español]**

1. Clona o descarga este repositorio
2. Abre `index.html` directamente en tu navegador (no necesitas servidor)
3. Haz clic en **"Cargar carpeta"** o arrastra una carpeta al canvas
4. ¡Empieza a organizar!

<br>

## ⌨️ Keyboard Shortcuts / Atajos de teclado

| Key / Tecla | Action (EN) | Acción (ES) |
|---|---|---|
| `S` | Toggle selection mode | Activar modo selección |
| `L` | Add text label to canvas | Añadir etiqueta de texto |
| `Ctrl + S` | Save layout | Guardar layout |
| `+` / `=` | Zoom in | Acercar |
| `-` | Zoom out | Alejar |
| `0` | Reset zoom / center view | Resetear zoom / centrar |
| `Escape` | Close modal / deselect | Cerrar modal / deseleccionar |
| `Delete` | Remove selected card(s) | Eliminar tarjeta(s) seleccionada(s) |
| `Ctrl + A` | Select all cards | Seleccionar todas las tarjetas |

<br>

## 🧩 Features / Funcionalidades

**[English]**
- 📂 Load entire folders of videos and images at once (mp4, mov, avi, jpg, png, webp, gif…)
- 🏷️ Tag files with custom labels and colors
- ✏️ Rename single or multiple files using pattern formulas (`{n}`, `{name}`)
- 🔀 Sort by name, duration, or file size
- 🔍 Filter by name or tag in real time
- 💾 Save and restore canvas layout via localStorage
- 🎨 Light / dark mode (respects system preference)
- 📜 Export a `.bat` rename script for actual file renaming on Windows
- ▶️ Inline video preview player

**[Español]**
- 📂 Carga carpetas enteras de videos e imágenes de una vez (mp4, mov, avi, jpg, png, webp, gif…)
- 🏷️ Etiqueta archivos con colores y nombres personalizados
- ✏️ Renombra uno o varios archivos usando fórmulas (`{n}`, `{name}`)
- 🔀 Ordena por nombre, duración o tamaño
- 🔍 Filtra por nombre o etiqueta en tiempo real
- 💾 Guarda y restaura el layout del canvas vía localStorage
- 🎨 Modo claro / oscuro (respeta la preferencia del sistema)
- 📜 Exporta un script `.bat` para renombrar archivos reales en Windows
- ▶️ Reproductor de preview de video integrado

<br>

## 🏷️ Rename Patterns / Patrones de renombrado

| Token | Description (EN) | Descripción (ES) | Example / Ejemplo |
|---|---|---|---|
| `{n}` | Auto-number (001, 002…) | Número automático | `clip_{n}` → `clip_001` |
| `{name}` | Original filename | Nombre original del archivo | `{name}_final` → `archivo_final` |

You can combine them: `{name}_{n}` → `myclip_001`  
Puedes combinarlos: `{name}_{n}` → `myclip_001`

<br>

## 🔒 Privacy / Privacidad

**[English]**  
VideoCanvas is 100% client-side. It uses the browser's [File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API) to read files — nothing is uploaded, transmitted, or stored outside your browser. Layout data is saved only in your own `localStorage`.

**[Español]**  
VideoCanvas es 100% del lado del cliente. Usa la [File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API) del navegador para leer archivos — nada se sube, transmite ni almacena fuera de tu navegador. Los datos del layout se guardan solo en tu propio `localStorage`.

<br>

## 🛠️ Tech Stack / Tecnologías

- Vanilla HTML5, CSS3, JavaScript (ES6+)
- No frameworks, no dependencies, no CDNs
- CSS Grid + Flexbox for layout
- `clamp()` for responsive typography
- CSS custom properties (`--var`) for theming
- `prefers-color-scheme` for auto dark/light mode

<br>

## 📁 File Structure / Estructura de archivos

```
videocanvas/
├── index.html      # Structure / Estructura
├── styles.css      # Styles & theming / Estilos y temas
└── script.js       # Logic & interactions / Lógica e interacciones
```

<br>

## 🤝 Contributing / Contribuir

**[English]**  
Pull requests are welcome! If you find a bug or have a feature idea, open an issue first so we can discuss it.

**[Español]**  
¡Los pull requests son bienvenidos! Si encontrás un bug o tenés una idea de feature, abrí primero un issue para discutirlo.

<br>

## 👤 Author / Autor

**Nano Ovalle**  
📸 Instagram: [@nano.ovalle](https://www.instagram.com/nano.ovalle/)

<br>

## 📄 License / Licencia

[MIT](LICENSE) — free to use, modify, and distribute.  
[MIT](LICENSE) — libre para usar, modificar y distribuir.
