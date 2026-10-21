# Instalación (resumen para la conversación)

La guía completa está en `docs/INSTALACION.md` del repo de la Factory. Lo que tenés que saber para orientar al usuario:

1. **El servicio** tiene que estar corriendo en una URL pública con HTTPS (Docker en un VPS/Railway/Fly/Render, con Postgres; o el ejecutor de GitHub Actions + Postgres para las tareas). Sin servicio no hay Factory: esta Skill sola no hace nada.
2. **Cowork no hereda nada** de Claude Code: ni el repo, ni archivos, ni conectores, ni variables. Hay que:
   - subir esta Skill (ZIP) en *Personalizar → Skills* (o *Configuración → Capacidades*), con «ejecución de código» activada;
   - agregar el **conector personalizado**: URL `https://<servicio>/mcp`. Claude abre la pantalla de la Factory y se autoriza con la llave del dueño (`SMF_OWNER_KEY`). El acceso es de agente: no puede aprobar.
3. **Credenciales** (sólo en el servicio, nunca en la Skill): Meta (token de usuario del sistema con `ads_management`, `ads_read`, `business_management`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`), cuenta publicitaria, página, Instagram, píxel y token de CAPI por producto, Resend o Telegram para avisos, Supabase Storage para media de Instagram, lectura de las bases de los productos.

Comprobación: `status` debería mostrar las integraciones; `meta_verify_account` hace una lectura real de la cuenta.
