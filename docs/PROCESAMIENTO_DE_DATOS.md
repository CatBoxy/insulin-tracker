# Procesamiento de Datos — GlycoFit

> Inventario de servicios terceros que procesan datos de participantes.
> Entregar a Alfredo para incorporar al consentimiento informado antes de la presentación al Comité de Ética.

---

## Servicios que reciben datos de participantes

### 1. Google — Gemini AI (parsing de documentos y personalización)

| Campo | Detalle |
|-------|---------|
| **Proveedor** | Google LLC, Mountain View, California, EE.UU. |
| **Servicio** | Generative Language API (Gemini 3.5 Flash) |
| **Qué datos recibe** | Imágenes/PDF de análisis clínicos subidos por pacientes o médicos; variables de contexto para personalización de mensajes (nombre, última glucemia, medicamentos) |
| **Para qué** | Extracción automática de valores de laboratorio; adaptación de tono en mensajes de recordatorio |
| **Dónde se almacena** | Los datos se envían via API y no se almacenan por Google según los términos de la API de Gemini (los datos de API no se usan para entrenamiento) |
| **Retención** | Transitoria — solo durante el procesamiento de la solicitud |

### 2. Cloudinary

| Campo | Detalle |
|-------|---------|
| **Proveedor** | Cloudinary Ltd., Santa Clara, California, EE.UU. |
| **Servicio** | Almacenamiento y entrega de archivos (imágenes, PDFs) |
| **Qué datos recibe** | Archivos adjuntos de controles médicos (fotos de análisis, recetas, estudios por imágenes) |
| **Para qué** | Almacenamiento persistente de documentos clínicos subidos por pacientes y médicos |
| **Dónde se almacena** | Servidores de Cloudinary en EE.UU. |
| **Retención** | Mientras dure el estudio y el período de retención de datos. Eliminable bajo solicitud. |

### 3. Backblaze B2

| Campo | Detalle |
|-------|---------|
| **Proveedor** | Backblaze Inc., San Mateo, California, EE.UU. |
| **Servicio** | Almacenamiento de respaldos de base de datos |
| **Qué datos recibe** | Copia completa de la base de datos PostgreSQL (encriptada en tránsito) |
| **Para qué** | Respaldo nocturno para prevención de pérdida de datos |
| **Dónde se almacena** | Servidores de Backblaze en EE.UU. |
| **Retención** | 30 copias diarias + 6 mensuales. Eliminable bajo solicitud. |

### 4. Resend

| Campo | Detalle |
|-------|---------|
| **Proveedor** | Resend Inc., San Francisco, California, EE.UU. |
| **Servicio** | Envío de correos electrónicos transaccionales |
| **Qué datos recibe** | Dirección de correo electrónico del participante, contenido del email (verificación de cuenta, recuperación de contraseña) |
| **Para qué** | Verificación de identidad y recuperación de acceso |
| **Dónde se almacena** | Logs de envío en servidores de Resend en EE.UU. |
| **Retención** | Según política de retención de Resend (típicamente 30 días para logs) |

### 5. Expo (EAS)

| Campo | Detalle |
|-------|---------|
| **Proveedor** | Expo (650 Industries Inc.), Palo Alto, California, EE.UU. |
| **Servicio** | Push notifications y compilación de la aplicación móvil |
| **Qué datos recibe** | Tokens de dispositivo para notificaciones push; contenido del mensaje de notificación |
| **Para qué** | Entrega de notificaciones push al dispositivo del participante |
| **Dónde se almacena** | Tokens en tránsito; mensajes no se almacenan después de la entrega |
| **Retención** | Transitoria |

---

## Servidor principal

| Campo | Detalle |
|-------|---------|
| **Proveedor** | Hetzner Online GmbH, Gunzenhausen, Alemania |
| **Ubicación** | Centro de datos en Ashburn, Virginia, EE.UU. |
| **Qué almacena** | Base de datos PostgreSQL con todos los datos del estudio, código de la aplicación |
| **Acceso** | Solo vía SSH con clave privada, puerto no estándar (2222) |

---

## Datos que NO se comparten con terceros

- Nombres completos de participantes (solo se envía el nombre al personalizar mensajes vía Gemini)
- DNI o documento de identidad
- Diagnósticos médicos completos
- Historia clínica familiar o personal
- Datos de contacto de cuidadores

---

## Recomendación

Incorporar esta información al consentimiento informado (§6) antes de la presentación al Comité de Ética. Ejemplo de texto sugerido:

*"Para el funcionamiento de la aplicación, ciertos datos pueden ser procesados por servicios tecnológicos de terceros ubicados en Estados Unidos y Alemania, incluyendo: almacenamiento de archivos clínicos, respaldos de seguridad, envío de correos electrónicos, notificaciones push, y análisis automatizado de documentos mediante inteligencia artificial. Estos servicios operan bajo sus respectivas políticas de privacidad y los datos se transmiten de forma encriptada."*
