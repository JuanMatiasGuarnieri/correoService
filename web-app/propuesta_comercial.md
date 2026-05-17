---
title: Propuesta Comercial - Correo Service
author: GUARNIERI NETWORK
---

# 🚚 Propuesta Comercial: Correo Service
**Sistema Inteligente de Logística y Navegación**

---

<div align="center">
  <img src="assets/mockup.png" alt="Correo Service Driver App" width="45%" />
  <img src="assets/monitoring_mockup.png" alt="Correo Service Monitoring Central" width="45%" />
</div>

## 1. Resumen Ejecutivo
**Correo Service** es una solución avanzada de logística diseñada específicamente para optimizadores de rutas y personal de entregas. Esta aplicación web progresiva (PWA) de nivel empresarial combina la potencia de algoritmos de optimización de rutas con un sistema de navegación GPS guiado por voz, todo dentro de una interfaz de diseño premium, fluida, offline-first y optimizada para dispositivos móviles.

Adicionalmente, cuenta con un portal centralizado de despacho que permite a la oficina monitorizar el trayecto del vehículo, el estado de sus entregas y eventos en tiempo real.

---

## 2. Características Principales

### 🗺️ Optimización de Rutas Inteligente
* **Búsqueda Inteligente OSM:** Cuenta con un panel de sugerencias y autocompletado en tiempo real.
* **Soporte TSP (Traveling Salesman Problem):** Calcula las trayectorias más eficientes entre múltiples paradas, minimizando distancias y tiempos de entrega.
* **Regreso a Base:** Opción para que el recorrido finalice exactamente en el depósito central o punto de partida original.

### 🎙️ Navegación GPS con Voz (Turn-by-Turn)
* **Guiado Interno en Vivo:** Elimina la necesidad de saltar entre aplicaciones de mapas externas.
* **Instrucciones en Tiempo Real:** Guía auditiva y visual de alta precisión para cada giro.
* **Detección Automática de Llegada:** Reconocimiento inteligente de proximidad (radio de 30m) para avanzar al siguiente destino de forma automática.

### 🛰️ Central de Monitoreo & Telemetría en Vivo
* **Telemetría Cloud Global:** Conexión en tiempo real usando **Google Firebase** entre la pantalla del conductor y el portal central.
* **Portal Dispatch Central:** Consola premium de pantalla completa para despachadores y oficinas que permite vigilar la ubicación GPS de los camiones y recibir alertas en vivo.
* **Panel de Estadísticas "Resumen de Jornada":** Informe corporativo con efectividad, paradas completadas y detalles de la jornada.

### 🚨 Sistema de Alerta S.O.S Satelital
* **Botón de Pánico Dual:** Accesible en la pantalla del conductor principal.
* **Confirmación por Filtro Anti-Error:** Modal premium solicitando confirmación crítica para evitar falsas alarmas satelitales.
* **Alertas por Voz y Visuales:** Al activarse, la consola de la Central emite alertas auditivas y visuales (marcador rojo carmesí, anillos de radar).

### 🔒 Acceso y Seguridad de Nivel Industrial
* **Doble Portal de Acceso Secure:** Acceso diferenciado para Chofer y Administrador.
* **Cifrado Reversible de Doble Vía:** Las contraseñas se almacenan de manera segura pero permitiendo la gestión administrativa.

### 👥 Panel de Gestión de Usuarios CRUD
* **CRUD Completo de Conductores:** Creación, modificación y eliminación de cuentas.
* **Sincronización Global en la Nube:** Actualizaciones en tiempo real en todos los dispositivos.

### 📱 Experiencia PWA & Modo Sin Conexión
* **Instalación Directa (PWA):** Se instala y ejecuta como una aplicación nativa.
* **Caché Inteligente de Mapas:** Funcionamiento offline sin necesidad de conexión permanente a internet.
* **Persistencia Local:** Posibilidad de guardar y cargar rutas sin conexión.

---

## 3. Arquitectura y Escalabilidad
El sistema está construido bajo una filosofía de alto rendimiento utilizando tecnologías probadas:
- Motor de mapas robusto (Leaflet)
- Base de datos en tiempo real (Firebase)
- Algoritmos de enrutamiento avanzados (OpenRouteService)
- Diseño responsivo y adaptable (Glassmorphism)

---

## 4. Beneficios para la Empresa
- **Reducción de Costos Operativos:** Minimización de kilómetros recorridos y tiempos muertos mediante rutas optimizadas.
- **Mayor Control:** Monitoreo en tiempo real de toda la flota desde la oficina.
- **Seguridad Mejorada:** Sistemas integrados de S.O.S y alertas de emergencia en vivo.
- **Facilidad de Uso:** Curva de aprendizaje mínima para los conductores gracias a la asistencia por voz y guiado interno.

---

> **GUARNIERI NETWORK**  
> *Innovación en Movimiento*
