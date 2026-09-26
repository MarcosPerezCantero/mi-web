# mi-web

Web personal de Marcos Pérez Cantero → **https://marcosperez.es**

Web estática (HTML/CSS/JS) servida con Docker + nginx en un VPS de OVH, con HTTPS de Let's Encrypt y despliegue automático con GitHub Actions en cada push a `main`.

## Arquitectura

```
git push (main)
   │
   ▼
GitHub Actions ──rsync + ssh──►  VPS OVH  (Ubuntu, carpeta del proyecto)
                                   │
                                   └─ docker compose
                                        ├─ nginx    :80/:443  proxy inverso + TLS
                                        │            (monta nginx/conf.d y certbot/)
                                        ├─ web      nginx:alpine con la web copiada dentro (Dockerfile)
                                        └─ certbot  solo se usa a mano para emitir/renovar certificados
```

- `nginx` redirige HTTP → HTTPS, sirve `/.well-known/acme-challenge/` para certbot y hace `proxy_pass` a `web:80`.
- La web se copia **dentro de la imagen** (`COPY` en el `Dockerfile`), así que cada cambio requiere reconstruir el contenedor `web`. El workflow lo hace solo.

## Decisiones de seguridad

- **SSH solo con clave** y una clave dedicada para CI/CD, revocable sin afectar al acceso personal.
- **Secretos fuera del repo**: credenciales en GitHub Secrets; certificados TLS y cuenta de Let's Encrypt solo en el servidor (`.gitignore`).
- **`known_hosts` fijado**: el runner verifica la identidad del servidor en vez de aceptar cualquier huella.
- **Despliegue defensivo**: valida la clave y la carpeta destino antes de tocar nada, y `rsync` excluye `certbot/`.
- **Imagen mínima**: `.dockerignore` deja fuera de la imagen todo lo que no es la web.
- **HTTPS obligatorio**: HTTP redirige a HTTPS.

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html`, `styles.css`, `app.js`, `profile.jpeg` | La web |
| `Dockerfile` | Imagen `web` (nginx:alpine + archivos de la web) |
| `.dockerignore` | Deja fuera de la imagen todo lo que no es la web |
| `docker-compose.yml` | Servicios `web`, `nginx` y `certbot` |
| `nginx/conf.d/default.conf` | Configuración del proxy y TLS |
| `certbot/` | **Solo en el servidor.** Certificados y cuenta de Let's Encrypt. Está en `.gitignore` y el despliegue no lo toca |
| `.github/workflows/deploy.yml` | Despliegue automático |

## Cómo hacer cambios

```bash
# editar archivos...
git add .
git commit -m "Descripción del cambio"
git push
```

En ~15 s el cambio está en producción. El estado se ve en la pestaña **Actions** del repo (o con `gh run watch`). También se puede lanzar a mano con *Run workflow*.

## Despliegue (`.github/workflows/deploy.yml`)

1. **Configurar SSH**: escribe la clave y `known_hosts` desde los secretos. Falla si la clave no es privada o tiene contraseña.
2. **Comprobar carpeta destino**: aborta si `VPS_PATH` no contiene `docker-compose.yml` y `certbot/conf/live`. Evita desplegar en una carpeta equivocada.
3. **Subir archivos**: `rsync --delete` del repo a `VPS_PATH`, excluyendo `.git/`, `.github/` y `certbot/`.
4. **Reconstruir**: `docker compose up -d --build web nginx`, recarga nginx y limpia imágenes viejas.

### Secretos del repo (Settings → Secrets and variables → Actions)

| Secreto | Valor |
|---|---|
| `VPS_HOST` | IP o dominio del VPS |
| `VPS_USER` | Usuario SSH del despliegue |
| `VPS_PATH` | Ruta absoluta del proyecto en el VPS |
| `VPS_KNOWN_HOSTS` | Huella ed25519 del servidor (`ssh-keyscan <host>`, línea `ssh-ed25519`) |
| `VPS_SSH_KEY` | Clave **privada** de despliegue, sin contraseña |
| `VPS_PORT` | Opcional, por defecto `22` |

## Acceso SSH al VPS

- Solo se entra con clave pública: autenticación por contraseña desactivada en `sshd`.
- Dos claves autorizadas para el usuario de despliegue:
  - Clave personal, protegida con contraseña.
  - Clave exclusiva de GitHub Actions, sin contraseña y usada solo en el secreto `VPS_SSH_KEY`. Para revocar el acceso de GitHub basta con borrar su línea de `~/.ssh/authorized_keys`.
- El usuario de despliegue está en el grupo `docker` para ejecutar `docker compose` sin `sudo`.

## Certificados HTTPS

- Let's Encrypt, método webroot (`/var/www/certbot`), para `marcosperez.es` y `www.marcosperez.es`.
- Validez de 90 días, **renovación automática** con cron en el VPS (dos veces al día). Certbot solo renueva cuando faltan menos de 30 días; después se recarga nginx:

```cron
0 3,15 * * * cd <ruta-del-proyecto> && docker compose run --rm certbot renew --quiet && docker compose exec -T nginx nginx -s reload
```

Comprobar que la renovación funciona sin tocar el certificado real:

```bash
cd <ruta-del-proyecto>
docker compose run --rm certbot renew --dry-run
```

Comprobar la fecha de caducidad desde cualquier sitio:

```bash
echo | openssl s_client -connect marcosperez.es:443 -servername marcosperez.es 2>/dev/null | openssl x509 -noout -dates
```

## Operación y recuperación

**El despliegue sale en rojo**: abrir el run en *Actions* (o `gh run view --log-failed`). Los errores de SSH o de carpeta destino se detectan antes de tocar el servidor.

**La web no carga**: en el VPS:

```bash
cd <ruta-del-proyecto>
docker compose ps
docker compose logs --tail 30 nginx
docker compose up -d web nginx
```

Si nginx se reinicia en bucle con `cannot load certificate`, comprobar que los contenedores se levantaron desde la carpeta real del proyecto (donde está `certbot/`):

```bash
docker inspect mi-web-nginx-1 --format '{{range .Mounts}}{{.Source}}{{println}}{{end}}'
```

**Volver a la versión anterior**:

```bash
git revert HEAD
git push
```

## Ejecutar en local

```bash
docker build -t mi-web .
docker run --rm -p 8080:80 mi-web
# http://localhost:8080
```

(El `docker-compose.yml` completo necesita los certificados de `certbot/`, que solo existen en el servidor.)
