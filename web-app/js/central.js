let map;
        let vehicleMarker = null;
        let baseMarker = null;
        let stopMarkers = [];
        let routeLine = null;
        let routeLineGlow = null;
        
        let lastKnownTelemetry = null;

        function initMap() {
            // Inicializar mapa en una posición por defecto (Buenos Aires/Mundo)
            map = L.map('map', {
                zoomControl: false,
                attributionControl: false
            }).setView([-34.6037, -58.3816], 13);

            // Capa de mapa oscura premium
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 20
            }).addTo(map);

            // Reposicionar el control de zoom para que no lo tapen los paneles
            L.control.zoom({
                position: 'bottomright'
            }).addTo(map);
        }

        function appendLog(text, type = 'neutral') {
            const feed = document.getElementById('logFeed');
            const item = document.createElement('div');
            const time = new Date().toLocaleTimeString();
            item.className = `log-item ${type}`;
            item.innerText = `[${time}] ${text}`;
            feed.appendChild(item);
            feed.scrollTop = feed.scrollHeight;
        }

        // Procesar cambios en telemetría local
        function processTelemetry(data) {
            if (!data) return;

            const isNewActive = !lastKnownTelemetry || lastKnownTelemetry.lastUpdate !== data.lastUpdate;
            lastKnownTelemetry = data;

            // 1. Actualizar estado de red
            const centralBadge = document.getElementById('centralStatusBadge');
            const centralDot = document.getElementById('centralStatusDot');
            const centralText = document.getElementById('centralStatusText');
            
            if (data.isOnline) {
                centralBadge.className = "online-status-indicator online";
                centralDot.className = "status-dot online";
                centralText.innerText = "Sincronizado";
            } else {
                centralBadge.className = "online-status-indicator offline";
                centralDot.className = "status-dot offline";
                centralText.innerText = "Desconectado";
            }

            // 2. Actualizar tarjetas del vehículo
            document.getElementById('valDriver').innerText = data.username || '-';
            
            if (data.lat && data.lon) {
                document.getElementById('valCoords').innerText = `${data.lat.toFixed(5)}, ${data.lon.toFixed(5)}`;
            } else {
                document.getElementById('valCoords').innerText = 'Sin señal GPS';
            }
            
            const totalStops = data.stops ? data.stops.length : 0;
            const completedStops = data.stops ? data.stops.filter(s => s.completed).length : 0;
            document.getElementById('valProgress').innerText = `${completedStops} / ${totalStops} paradas`;
            document.getElementById('valLastReport').innerText = data.lastUpdate || '-';

            const activeLabel = document.getElementById('vehicleActiveLabel');
            const vCard = document.getElementById('vehicleCard');
            
            if (data.isSos) {
                activeLabel.innerText = "🚨 EMERGENCIA S.O.S";
                activeLabel.style.color = "#ef4444";
                activeLabel.style.background = "rgba(239, 68, 68, 0.15)";
                vCard.classList.add('sos-active');
            } else {
                vCard.classList.remove('sos-active');
                if (data.isNavigating) {
                    activeLabel.innerText = "EN RUTA";
                    activeLabel.style.color = "var(--accent-cyan)";
                    activeLabel.style.background = "rgba(6, 182, 212, 0.15)";
                } else if (data.routeActive) {
                    activeLabel.innerText = "LISTO";
                    activeLabel.style.color = "var(--accent-green)";
                    activeLabel.style.background = "rgba(16, 185, 129, 0.15)";
                } else {
                    activeLabel.innerText = "INACTIVO";
                    activeLabel.style.color = "var(--text-dim)";
                    activeLabel.style.background = "rgba(255,255,255,0.05)";
                }
            }

            // Inyectar botón de centrado si hay coordenadas
            const centerBtnContainer = document.getElementById('centerBtnContainer');
            if (data.lat && data.lon && centerBtnContainer.innerHTML === '') {
                centerBtnContainer.innerHTML = `
                    <button onclick="centerOnVehicle()" class="dispatch-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                        Centrar Mapa en Móvil 01
                    </button>
                `;
            } else if ((!data.lat || !data.lon) && centerBtnContainer.innerHTML !== '') {
                centerBtnContainer.innerHTML = '';
            }

            // 3. Dibujar mapa (Marcador camión, paradas, ruta)
            renderMapTelemetry(data, isNewActive);

            // 4. Renderizar Itinerario en la lista lateral
            renderStopsList(data);
        }

        function renderMapTelemetry(data, isNewActive) {
            // A. Dibujar el camión
            if (data.lat && data.lon) {
                const pos = [data.lat, data.lon];
                const sosClass = data.isSos ? 'dispatch-truck-marker sos-active' : 'dispatch-truck-marker';
                
                if (!vehicleMarker) {
                    vehicleMarker = L.marker(pos, {
                        icon: L.divIcon({
                            className: 'custom-div-icon',
                            html: `
                                <div class="${sosClass}">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm2-5.5h-3V9h3v4z"/>
                                    </svg>
                                </div>
                            `,
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    }).addTo(map);
                    
                    if (isNewActive) {
                        appendLog(`🚛 Vehículo 'Móvil 01' detectado en mapa por primera vez.`, 'info');
                        map.setView(pos, 15);
                    }
                } else {
                    vehicleMarker.setIcon(L.divIcon({
                        className: 'custom-div-icon',
                        html: `
                            <div class="${sosClass}">
                                <svg viewBox="0 0 24 24">
                                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm2-5.5h-3V9h3v4z"/>
                                </svg>
                            </div>
                        `,
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                    }));

                    const oldPos = vehicleMarker.getLatLng();
                    if (oldPos.lat !== data.lat || oldPos.lng !== data.lon) {
                        vehicleMarker.setLatLng(pos);
                        if (data.isNavigating) {
                            map.panTo(pos);
                        }
                        if (isNewActive) {
                            appendLog(`📡 Telemetría recibida: Móvil 01 se desplazó a [${data.lat.toFixed(5)}, ${data.lon.toFixed(5)}]`, 'neutral');
                        }
                    }
                }
            } else if (vehicleMarker) {
                map.removeLayer(vehicleMarker);
                vehicleMarker = null;
                appendLog(`⚠️ Conexión satelital del GPS perdida con Móvil 01.`, 'warn');
            }

            // B. Dibujar base de salida
            if (data.origin) {
                const basePos = [data.origin.lat, data.origin.lon];
                if (!baseMarker) {
                    baseMarker = L.marker(basePos, {
                        icon: L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div class="custom-pin-base"></div>`,
                            iconSize: [28, 28],
                            iconAnchor: [14, 28]
                        })
                    }).addTo(map);
                } else {
                    baseMarker.setLatLng(basePos);
                }
            } else if (baseMarker) {
                map.removeLayer(baseMarker);
                baseMarker = null;
            }

            // C. Dibujar marcadores de entregas
            stopMarkers.forEach(m => map.removeLayer(m));
            stopMarkers = [];
            
            if (data.stops && data.stops.length > 0) {
                data.stops.forEach((stop, index) => {
                    const stopPos = [stop.lat, stop.lon];
                    const pinColor = stop.completed ? '#10b981' : (index === data.currentTargetIndex && data.isNavigating ? '#06b6d4' : '#4f46e5');
                    
                    const marker = L.marker(stopPos, {
                        icon: L.divIcon({
                            className: 'custom-div-icon',
                            html: `
                                <div class="custom-pin-stop" style="background: ${pinColor}">
                                    <span>${index + 1}</span>
                                </div>
                            `,
                            iconSize: [24, 24],
                            iconAnchor: [12, 24]
                        })
                    }).addTo(map);
                    
                    marker.bindPopup(`<b>Entrega ${index + 1}</b><br>${stop.name}<br>Estado: ${stop.completed ? 'Completado' : 'Pendiente'}`);
                    stopMarkers.push(marker);
                });
            }

            // D. Trazar líneas de ruta entre paradas
            if (routeLine) map.removeLayer(routeLine);
            if (routeLineGlow) map.removeLayer(routeLineGlow);
            
            if (data.origin && data.stops && data.stops.length > 0) {
                const coords = [[data.origin.lat, data.origin.lon]];
                data.stops.forEach(s => coords.push([s.lat, s.lon]));
                
                routeLineGlow = L.polyline(coords, {
                    color: '#06b6d4',
                    weight: 8,
                    opacity: 0.15,
                    dashArray: '5, 10'
                }).addTo(map);
                
                routeLine = L.polyline(coords, {
                    color: '#4f46e5',
                    weight: 4,
                    opacity: 0.5,
                    dashArray: '5, 10'
                }).addTo(map);
            }
        }

        function renderStopsList(data) {
            const container = document.getElementById('stopsListContainer');
            
            if (!data.origin && (!data.stops || data.stops.length === 0)) {
                container.innerHTML = `
                    <div class="empty-dispatch-card">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 17V7l7 5z"/></svg>
                        <p>Esperando telemetría del vehículo para cargar el itinerario...</p>
                    </div>
                `;
                return;
            }

            let html = '';

            // Render Base de Salida
            if (data.origin) {
                html += `
                    <div class="route-stop-item">
                        <div class="stop-circle base">🏠</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; color: white; font-size: 0.8rem;">PUNTO DE PARTIDA (BASE)</div>
                            <div style="color: var(--text-dim); font-size: 0.7rem; margin-top: 2px;">${data.origin.name}</div>
                        </div>
                    </div>
                `;
            }

            // Render Paradas
            if (data.stops && data.stops.length > 0) {
                data.stops.forEach((stop, index) => {
                    let circleClass = 'pending';
                    let statusLabel = '⏳ Pendiente';
                    let statusColor = 'var(--text-dim)';
                    
                    if (stop.completed) {
                        circleClass = 'completed';
                        statusLabel = '✅ Completado';
                        statusColor = 'var(--accent-green)';
                    } else if (index === data.currentTargetIndex && data.isNavigating) {
                        circleClass = 'active';
                        statusLabel = '🚚 Entrega en Camino';
                        statusColor = 'var(--accent-cyan)';
                    }

                    html += `
                        <div class="route-stop-item" style="${index === data.currentTargetIndex && data.isNavigating ? 'border-color: rgba(6,182,212,0.25); background: rgba(6,182,212,0.02);' : ''}">
                            <div class="stop-circle ${circleClass}">${index + 1}</div>
                            <div style="flex: 1;">
                                <div style="font-weight: 700; color: white; font-size: 0.8rem;">ENTREGA ${index + 1}</div>
                                <div style="color: var(--text-dim); font-size: 0.7rem; margin-top: 2px;">${stop.name}</div>
                            </div>
                            <div style="font-weight: 700; font-size: 0.65rem; color: ${statusColor};">${statusLabel}</div>
                        </div>
                    `;
                });
            }

            container.innerHTML = html;
        }

        window.centerOnVehicle = function() {
            if (lastKnownTelemetry && lastKnownTelemetry.lat && lastKnownTelemetry.lon) {
                map.setView([lastKnownTelemetry.lat, lastKnownTelemetry.lon], 16, { animate: true });
                appendLog("🔍 Centrando visor del despacho en Móvil 01.", "neutral");
            }
        };

        function handleIncomingData(data) {
            // Comprobar eventos y cambios de estado para el registro de eventos
            if (lastKnownTelemetry) {
                if (data.isNavigating && !lastKnownTelemetry.isNavigating) {
                    appendLog("🚀 Móvil 01 inició GPS de navegación.", "info");
                } else if (!data.isNavigating && lastKnownTelemetry.isNavigating) {
                    appendLog("⏹️ Móvil 01 detuvo navegación GPS.", "warn");
                }

                if (data.currentTargetIndex > lastKnownTelemetry.currentTargetIndex) {
                    const completedIndex = lastKnownTelemetry.currentTargetIndex;
                    const stopName = data.stops[completedIndex] ? data.stops[completedIndex].name : '';
                    appendLog(`✅ Móvil 01 completó la Parada ${completedIndex + 1}: ${stopName}`, "info");
                }

                if (data.stops.length > lastKnownTelemetry.stops.length) {
                    appendLog(`➕ Planificador: Se añadieron destinos al itinerario (${data.stops.length} paradas).`, "neutral");
                }

                // Alertas de Emergencia SOS
                if (data.isSos && !lastKnownTelemetry.isSos) {
                    appendLog("🚨 [CRÍTICO] MÓVIL 01 ACTIVÓ ALERTA S.O.S - EMERGENCIA EN RUTA", "critical");
                    speakCentral("¡Atención! El vehículo Móvil 01 ha activado una señal de emergencia S.O.S. Verifique su ubicación en el mapa de inmediato.");
                } else if (!data.isSos && lastKnownTelemetry.isSos) {
                    appendLog("💚 [SISTEMA] Alerta S.O.S cancelada por el conductor.", "info");
                    speakCentral("Alerta S.O.S del Móvil 01 cancelada.");
                }
            }

            processTelemetry(data);
        }

        // Escuchar cambios satelitales localmente (Storage Event - Respaldo)
        window.addEventListener('storage', (e) => {
            if (e.key === 'fleet_telemetry_admin') {
                try {
                    handleIncomingData(JSON.parse(e.newValue));
                } catch (err) {
                    console.error("Error al procesar el enlace local:", err);
                }
            }
        });

        // Integración de cliente Firebase para Telemetría Global por Internet
        async function initFirebase() {
            try {
                const telemetryRef = database.ref('telemetry/admin_channel');
                
                appendLog("🌐 [FIREBASE] Conectando a la red de monitoreo en la nube...", "info");
                
                telemetryRef.on('value', (snapshot) => {
                    if (snapshot.exists()) {
                        try {
                            handleIncomingData(snapshot.val());
                        } catch (err) {
                            console.error("Error procesando telemetría de Firebase:", err);
                        }
                    }
                });
                
                appendLog("✅ [FIREBASE] Enlace satelital global establecido con éxito.", "success");
            } catch(e) {
                console.error("No se pudo inicializar Firebase:", e);
                appendLog("⚠️ [FIREBASE] Error de conexión a la base de datos.", "warn");
            }
        }
        initFirebase();

        window.goToUsers = function() {
            if (typeof SpeechSynthesisUtterance !== 'undefined') {
                const utterance = new SpeechSynthesisUtterance("Abriendo panel de control de usuarios.");
                utterance.lang = 'es-ES';
                window.speechSynthesis.speak(utterance);
            }
            setTimeout(() => {
                window.location.href = 'usuarios.html';
            }, 500);
        };

        window.logoutCentral = function() {
            if (typeof SpeechSynthesisUtterance !== 'undefined') {
                const utterance = new SpeechSynthesisUtterance("Cerrando sesión de control. Hasta luego.");
                utterance.lang = 'es-ES';
                window.speechSynthesis.speak(utterance);
            }
            // Limpiar la sesión para evitar auto-login al volver a index.html
            sessionStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('userLogin');
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 600);
        };

        function speakCentral(text) {
            if (typeof SpeechSynthesisUtterance !== 'undefined') {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'es-ES';
                window.speechSynthesis.speak(utterance);
            }
        }

        window.onload = () => {
            initMap();
            
            // Registrar Service Worker para soporte PWA de Monitoreo
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js')
                    .then(() => console.log('[PWA] Service Worker registrado para la Central'))
                    .catch(err => console.error('[PWA] Error al registrar Service Worker', err));
            }
            
            // Carga inicial de datos si ya existen
            const initialData = localStorage.getItem('fleet_telemetry_admin');
            if (initialData) {
                try {
                    const data = JSON.parse(initialData);
                    appendLog("📡 Enlace satelital activo. Leyendo telemetría inicial...", "neutral");
                    processTelemetry(data);
                } catch(e){}
            } else {
                appendLog("⏳ Esperando que el vehículo Móvil 01 inicie sesión y transmita telemetría...", "neutral");
            }
        };