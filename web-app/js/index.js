let map;
        let origin = null;
        let stops = [];
        let markers = [];
        let originMarker = null;
        let routeLine;
        let routeLineGlow; // Glow route effect
        let userMarker = null;
        let watchId = null;
        let isNavigating = false;
        let isSos = false;
        let currentTargetIndex = -1;
        let voiceEnabled = true;
        let voiceVol = 1.0;
        let nearTargetSpoken = false;
        let routeSteps = [];
        let currentStepIndex = 0;
        let lastInstruction = "";
        let debounceTimeout; // Geocoding autocomplete debounce
        
        // REEMPLAZA ESTO CON TU CLAVE GRATUITA DE OPENROUTESERVICE.ORG
        const ORS_API_KEY = 'API KEY DE OPENROUTESERVICE'; 

        // Inicializar Mapa
        function initMap() {
            map = L.map('map', {
                zoomControl: false,
                attributionControl: false
            }).setView([-34.6037, -58.3816], 13);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19
            }).addTo(map);
            
            // Intentar obtener ubicación actual
            map.locate({setView: true, maxZoom: 15});
        }

        // --- NAVEGACIÓN Y MARCADORES PERSONALIZADOS ---
        function createBaseMarker(lat, lon, name) {
            return L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'custom-div-icon',
                    html: `
                        <div class="marker-base">
                            <div class="marker-pin base-pin">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                            <div class="marker-pulse"></div>
                        </div>
                    `,
                    iconSize: [30, 42],
                    iconAnchor: [15, 42]
                })
            }).addTo(map).bindPopup("<b>Base:</b> " + name);
        }

        function createStopMarker(lat, lon, name, index) {
            return L.marker([lat, lon], {
                icon: L.divIcon({
                    className: 'custom-div-icon',
                    html: `
                        <div class="marker-base">
                            <div class="marker-pin stop-pin">
                                <span style="font-weight: 800; font-size: 0.75rem; color: white;">${index}</span>
                            </div>
                        </div>
                    `,
                    iconSize: [30, 42],
                    iconAnchor: [15, 42]
                })
            }).addTo(map).bindPopup(`<b>Entrega #${index}:</b><br>${name}`);
        }

        // --- AUTOCOMPLETE DE DIRECCIONES (SUGERENCIAS) ---
        function showSuggestions(inputEl, containerId, isOrigin) {
            const query = inputEl.value;
            const container = document.getElementById(containerId);
            clearTimeout(debounceTimeout);
            
            if (!query || query.length < 3) {
                container.style.display = 'none';
                return;
            }

            debounceTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                    const data = await response.json();
                    
                    container.innerHTML = '';
                    if (data && data.length > 0) {
                        data.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            div.innerText = `📍 ${item.display_name}`;
                            div.addEventListener('click', () => {
                                selectSuggestion(item, inputEl, container, isOrigin);
                            });
                            container.appendChild(div);
                        });
                        container.style.display = 'block';
                    } else {
                        const div = document.createElement('div');
                        div.style.padding = '12px';
                        div.style.fontSize = '0.8rem';
                        div.style.color = 'var(--text-dim)';
                        div.style.textAlign = 'center';
                        div.innerText = 'No se encontraron resultados';
                        container.appendChild(div);
                        container.style.display = 'block';
                    }
                } catch (error) {
                    console.error(error);
                }
            }, 350);
        }

        function selectSuggestion(item, inputEl, container, isOrigin) {
            inputEl.value = '';
            container.style.display = 'none';
            
            if (isOrigin) {
                setOriginFromData(item);
            } else {
                addStopFromData(item);
            }
        }

        function setOriginFromData(result) {
            if (originMarker) map.removeLayer(originMarker);
            
            origin = {
                name: result.display_name,
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon)
            };

            originMarker = createBaseMarker(origin.lat, origin.lon, origin.name);
            originMarker.openPopup();
            map.panTo([origin.lat, origin.lon]);
            renderStops();
        }

        function addStopFromData(result) {
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            
            const stop = {
                id: Date.now(),
                name: result.display_name,
                lat: lat,
                lon: lon,
                completed: false
            };

            stops.push(stop);
            renderStops();
            
            const marker = createStopMarker(lat, lon, stop.name, stops.length);
            marker.openPopup();
            markers.push({id: stop.id, marker: marker});
            map.panTo([lat, lon]);
        }

        // Cierre automático de autocompletes al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.querySelectorAll('.autocomplete-suggestions').forEach(el => {
                    el.style.display = 'none';
                });
            }
        });

        async function setOrigin() {
            const input = document.getElementById('originInput');
            const query = input.value;
            if (!query) return;

            const result = await searchAddress(query);
            if (result) {
                setOriginFromData(result);
                input.value = '';
            }
        }

        async function searchAddress(query) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                return data.length > 0 ? data[0] : null;
            } catch (error) {
                console.error(error);
                return null;
            }
        }

        async function addStop() {
            const input = document.getElementById('addressInput');
            const query = input.value;
            if (!query) return;

            const result = await searchAddress(query);
            if (result) {
                addStopFromData(result);
                input.value = '';
            } else {
                alert('No se encontró la dirección');
            }
        }

        function renderStops() {
            const container = document.getElementById('stopsList');
            if (!origin && stops.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; color: var(--text-dim); padding: 25px 15px; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.06); margin-top: 10px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="url(#correoGrad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px; filter: drop-shadow(0 2px 6px rgba(6,182,212,0.3));"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                        <h4 style="color: white; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">Planifica tu Ruta</h4>
                        <p style="font-size: 0.75rem; line-height: 1.4; color: var(--text-dim);">Establece un punto de partida (Base) y agrega los destinos de entrega para calcular el trayecto más eficiente.</p>
                    </div>
                `;
                return;
            }

            let html = '';
            
            if (origin) {
                html += `
                    <div class="stop-item origin animate-fade">
                        <span class="stop-name">
                            <span class="origin-badge">BASE</span>
                            ${origin.name}
                        </span>
                    </div>
                `;
            }

            html += stops.map((stop, index) => `
                <div class="stop-item animate-fade ${stop.completed ? 'completed' : ''}">
                    <span class="stop-name" style="display: flex; align-items: flex-start; gap: 8px;">
                        <b style="background: rgba(255,255,255,0.1); border-radius: 50%; min-width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.7rem; color: white;">${index + 1}</b>
                        <span>${stop.name}</span>
                    </span>
                    ${!stop.completed ? `
                    <button class="remove-btn" onclick="removeStop(${stop.id})">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>` : '✅'}
                </div>
            `).join('');

            container.innerHTML = html;
        }

        function removeStop(id) {
            stops = stops.filter(s => s.id !== id);
            const markerObj = markers.find(m => m.id === id);
            if (markerObj) {
                map.removeLayer(markerObj.marker);
                markers = markers.filter(m => m.id !== id);
            }
            
            // Re-indexar y re-dibujar marcadores restantes
            markers.forEach((mObj, idx) => {
                const stopObj = stops.find(s => s.id === mObj.id);
                if (stopObj) {
                    map.removeLayer(mObj.marker);
                    mObj.marker = createStopMarker(stopObj.lat, stopObj.lon, stopObj.name, idx + 1);
                }
            });
            
            renderStops();
        }

        async function optimizeRoute() {
            if (!origin || stops.length < 1) {
                alert('Agrega el punto de partida y al menos 1 destino');
                return;
            }

            if (ORS_API_KEY === 'TU_CLAVE_AQUI') {
                alert('Por favor, ingresa tu clave gratuita de OpenRouteService en el código para ver el trazado por las calles.');
                drawSimpleRoute();
                return;
            }

            const returnToBase = document.getElementById('returnToBase').checked;

            const coords = [
                [origin.lon, origin.lat],
                ...stops.map(s => [s.lon, s.lat])
            ];

            if (returnToBase) {
                coords.push([origin.lon, origin.lat]);
            }

            try {
                const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': ORS_API_KEY
                    },
                    body: JSON.stringify({ 
                        coordinates: coords,
                        language: "es" 
                    })
                });

                if (!response.ok) throw new Error('Error en el servicio de rutas');

                const data = await response.json();
                const routeCoords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
                
                routeSteps = data.features[0].properties.segments[0].steps;
                currentStepIndex = 0;

                if (routeLineGlow) map.removeLayer(routeLineGlow);
                if (routeLine) map.removeLayer(routeLine);

                // Neon Glow effect
                routeLineGlow = L.polyline(routeCoords, {
                    color: '#06b6d4',
                    weight: 10,
                    opacity: 0.35,
                    lineJoin: 'round'
                }).addTo(map);

                routeLine = L.polyline(routeCoords, {
                    color: '#4f46e5',
                    weight: 5,
                    opacity: 0.9,
                    lineJoin: 'round'
                }).addTo(map);

                map.fitBounds(routeLine.getBounds(), {padding: [50, 50]});
                
                const distance = (data.features[0].properties.summary.distance / 1000).toFixed(2);
                const duration = Math.round(data.features[0].properties.summary.duration / 60);
                
                document.getElementById('btnNav').style.display = 'flex';
                alert(`Ruta optimizada: ${distance} km - aprox. ${duration} min`);
                syncTelemetry();

            } catch (error) {
                console.error(error);
                alert('Hubo un problema al calcular la ruta por las calles. Usando trazado simple.');
                drawSimpleRoute();
            }
        }

        function drawSimpleRoute() {
            if (routeLineGlow) map.removeLayer(routeLineGlow);
            if (routeLine) map.removeLayer(routeLine);
            const coords = [
                [origin.lat, origin.lon],
                ...stops.map(s => [s.lat, s.lon])
            ];
            routeLineGlow = L.polyline(coords, {color: '#06b6d4', weight: 8, opacity: 0.25, dashArray: '5, 10'}).addTo(map);
            routeLine = L.polyline(coords, {color: '#4f46e5', weight: 4, opacity: 0.7, dashArray: '5, 10'}).addTo(map);
            map.fitBounds(routeLine.getBounds(), {padding: [50, 50]});
            document.getElementById('btnNav').style.display = 'flex';
            syncTelemetry();
        }

        function startNavigation() {
            if (!origin || stops.length === 0) return;
            
            isNavigating = true;
            currentTargetIndex = 0;
            nearTargetSpoken = false;
            document.getElementById('mainUI').style.display = 'none';
            document.getElementById('btnNav').style.display = 'none';
            document.getElementById('navBar').style.display = 'flex';
            document.getElementById('topNavInstruction').style.display = 'flex';
            
            updateNavUI();
            startTracking();
            speak(`Iniciando navegación. Tu primera parada es ${stops[0].name}`);
        }

        function startTracking() {
            if (!navigator.geolocation) return;

            watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    const userPos = [lat, lon];

                    if (!userMarker) {
                        userMarker = L.marker(userPos, {
                            icon: L.divIcon({
                                className: 'custom-div-icon',
                                html: `
                                    <div class="user-location-marker">
                                        <div class="core"></div>
                                        <div class="pulse"></div>
                                    </div>
                                `,
                                iconSize: [24, 24],
                                iconAnchor: [12, 12]
                            })
                        }).addTo(map);
                    } else {
                        userMarker.setLatLng(userPos);
                    }

                    if (isNavigating) {
                        map.setView(userPos, 17, { animate: true }); // Zoom más cercano para GPS
                        checkArrival(lat, lon);
                        processTurnByTurn(lat, lon);
                    }
                    syncTelemetry(lat, lon);
                },
                (err) => console.error(err),
                { enableHighAccuracy: true }
            );
        }

        function checkArrival(userLat, userLon) {
            if (currentTargetIndex >= stops.length) return;
            
            const target = stops[currentTargetIndex];
            const dist = getDistance(userLat, userLon, target.lat, target.lon);
            
            document.getElementById('distDisplay').innerText = `${dist.toFixed(0)}m`;

            if (dist < 100 && !nearTargetSpoken) {
                speak(`Te estás acercando a tu destino: ${target.name}`);
                nearTargetSpoken = true;
            }

            if (dist < 30) { // 30 metros para considerar llegada automática
                speak("Has llegado a tu destino.");
                manualArrival();
            }
        }

        function processTurnByTurn(userLat, userLon) {
            if (!routeSteps || routeSteps.length === 0 || currentStepIndex >= routeSteps.length) return;

            const step = routeSteps[currentStepIndex];
            // La API de ORS no da las coords exactas de cada paso en el GeoJSON de forma simple aquí,
            // pero podemos estimar el progreso por la distancia total del segmento si fuera necesario.
            // Para simplificar, mostraremos la instrucción actual y la siguiente basada en proximidad.
            
            const stepBox = document.getElementById('stepBox');
            const stepText = document.getElementById('stepText');
            
            if (step.instruction !== lastInstruction) {
                stepBox.style.display = 'flex';
                stepText.innerText = step.instruction;
                speak(step.instruction);
                lastInstruction = step.instruction;
            }

            // Si la distancia al destino es pequeña, podríamos avanzar pasos, 
            // pero el API de ORS agrupa los pasos por segmentos entre paradas.
        }

        function manualArrival() {
            if (currentTargetIndex < stops.length) {
                stops[currentTargetIndex].completed = true;
                currentTargetIndex++;
                nearTargetSpoken = false;
                
                if (currentTargetIndex >= stops.length) {
                    speak("Felicidades, has completado todas las entregas. Gracias por Utilizar Correo Service");
                    showRouteCompletionStats();
                    stopNavigation();
                } else {
                    speak(`Siguiente parada: ${stops[currentTargetIndex].name}`);
                    updateNavUI();
                    renderStops();
                    syncTelemetry();
                }
            }
        }

        function updateNavUI() {
            const target = stops[currentTargetIndex];
            document.getElementById('nextStopName').innerText = target.name;
        }

        function stopNavigation() {
            isNavigating = false;
            document.getElementById('mainUI').style.display = 'flex';
            document.getElementById('navBar').style.display = 'none';
            document.getElementById('topNavInstruction').style.display = 'none';
            document.getElementById('btnNav').style.display = 'flex';
            if (watchId) navigator.geolocation.clearWatch(watchId);
            renderStops();
            syncTelemetry();
        }

        function getDistance(lat1, lon1, lat2, lon2) {
            const R = 6371e3; // Radio de la tierra en metros
            const f1 = lat1 * Math.PI/180;
            const f2 = lat2 * Math.PI/180;
            const df = (lat2-lat1) * Math.PI/180;
            const dl = (lon2-lon1) * Math.PI/180;
            const a = Math.sin(df/2) * Math.sin(df/2) +
                      Math.cos(f1) * Math.cos(f2) *
                      Math.sin(dl/2) * Math.sin(dl/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }

        // --- PERSISTENCIA (GUARDAR / CARGAR) ---
        function saveRoute() {
            if (!origin && stops.length === 0) {
                alert("No hay nada que guardar.");
                return;
            }
            const routeData = {
                origin: origin,
                stops: stops,
                returnToBase: document.getElementById('returnToBase').checked
            };
            localStorage.setItem('savedRoute', JSON.stringify(routeData));
            alert("Ruta guardada correctamente para mañana.");
        }

        function loadRoute() {
            const saved = localStorage.getItem('savedRoute');
            if (!saved) {
                alert("No tienes rutas guardadas.");
                return;
            }
            
            const data = JSON.parse(saved);
            
            // Limpiar mapa actual
            if (originMarker) map.removeLayer(originMarker);
            if (routeLineGlow) map.removeLayer(routeLineGlow);
            if (routeLine) map.removeLayer(routeLine);
            markers.forEach(m => map.removeLayer(m.marker));
            markers = [];
            
            // Restaurar datos
            origin = data.origin;
            stops = data.stops.map(s => ({...s, completed: false})); // Reiniciar progreso
            document.getElementById('returnToBase').checked = data.returnToBase;
            
            // Re-dibujar en mapa
            if (origin) {
                originMarker = createBaseMarker(origin.lat, origin.lon, origin.name);
            }
            
            stops.forEach((stop, index) => {
                const marker = createStopMarker(stop.lat, stop.lon, stop.name, index + 1);
                markers.push({id: stop.id, marker: marker});
            });
            
            renderStops();
            if (origin) map.panTo([origin.lat, origin.lon]);
            alert("Ruta cargada. ¡Listo para salir!");
        }

        // --- GUÍA POR VOZ ---
        function speak(text) {
            if (!voiceEnabled) return;
            window.speechSynthesis.cancel();
            const msg = new SpeechSynthesisUtterance(text);
            msg.lang = 'es-ES';
            msg.rate = 1.0;
            msg.volume = voiceVol;
            window.speechSynthesis.speak(msg);
        }

        function updateVolume(val) {
            voiceVol = parseFloat(val);
            // Pequeña prueba para que el usuario escuche el nivel
            if (isNavigating) speak("Volumen");
        }

        function toggleVoice() {
            voiceEnabled = !voiceEnabled;
            document.getElementById('voiceOn').style.display = voiceEnabled ? 'block' : 'none';
            document.getElementById('voiceOff').style.display = voiceEnabled ? 'none' : 'block';
        }

        window.onload = () => {
            initMap();
            checkSession();
            registerServiceWorker();
            updateOnlineStatus();
        };

        function registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./sw.js')
                    .then((reg) => console.log('Service Worker registrado con éxito:', reg.scope))
                    .catch((err) => console.error('Error al registrar el Service Worker:', err));
            }
        }

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        function updateOnlineStatus() {
            const isOnline = navigator.onLine;
            const indicators = document.querySelectorAll('.online-status-indicator');
            indicators.forEach(ind => {
                if (isOnline) {
                    ind.innerHTML = '<span class="status-dot online"></span> En Línea';
                    ind.className = 'online-status-indicator online';
                } else {
                    ind.innerHTML = '<span class="status-dot offline"></span> Sin Conexión';
                    ind.className = 'online-status-indicator offline';
                }
            });
        }

        function checkSession() {
            if (sessionStorage.getItem('isLoggedIn') === 'true') {
                document.getElementById('loginOverlay').style.display = 'none';
            }
        }

        async function sha256(message) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }

        async function syncTelemetry(lat = null, lon = null) {
            if (sessionStorage.getItem('isLoggedIn') !== 'true') return;
            const user = sessionStorage.getItem('username') || 'Móvil 01';
            const userLogin = sessionStorage.getItem('userLogin') || 'admin';

            // Obtener coordenadas de usuario
            let currentLat = lat;
            let currentLon = lon;
            if (!currentLat && userMarker) {
                const pos = userMarker.getLatLng();
                currentLat = pos.lat;
                currentLon = pos.lng;
            } else if (!currentLat && origin) {
                currentLat = origin.lat;
                currentLon = origin.lon;
            }

            const telemetry = {
                username: `${user} (${userLogin})`,
                lat: currentLat,
                lon: currentLon,
                isOnline: navigator.onLine,
                isNavigating: isNavigating,
                routeActive: (stops.length > 0 && origin !== null),
                origin: origin,
                stops: stops.map((s, idx) => ({
                    id: s.id,
                    name: s.name,
                    lat: s.lat,
                    lon: s.lon,
                    completed: idx < currentTargetIndex
                })),
                currentTargetIndex: currentTargetIndex,
                isSos: isSos,
                lastUpdate: new Date().toLocaleTimeString()
            };

            const payload = JSON.stringify(telemetry);
            
            // 1. Guardar local (modo offline/respaldo)
            localStorage.setItem('fleet_telemetry_admin', payload);
            
            // 2. Transmitir en vivo a Firebase
            database.ref('telemetry/admin_channel').set(telemetry).catch(e => console.error(e));
        }

        window.toggleSOS = function() {
            if (!isSos) {
                // Solicitar confirmación premium para activar la alerta S.O.S
                if (document.getElementById('sosConfirmModal')) return;

                const modal = document.createElement('div');
                modal.id = 'sosConfirmModal';
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(10px);
                    z-index: 20000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                `;

                modal.innerHTML = `
                    <div class="glass-card animate-fade" id="sosConfirmCard" style="width: 90%; max-width: 380px; padding: 32px 24px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.25); box-shadow: 0 20px 50px rgba(239, 68, 68, 0.15);">
                        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; box-shadow: 0 0 20px rgba(239, 68, 68, 0.3); animation: statusPulse 1s infinite;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        </div>
                        
                        <span style="font-size: 0.65rem; font-weight: 800; letter-spacing: 2px; color: #ef4444; text-transform: uppercase;">Confirmación Crítica</span>
                        <h2 style="font-size: 1.25rem; font-weight: 800; color: white; margin: 4px 0 12px 0; letter-spacing: 0.5px;">¿ACTIVAR SEÑAL S.O.S?</h2>
                        <p style="color: var(--text-dim); font-size: 0.8rem; line-height: 1.5; margin-bottom: 24px;">Esta acción emitirá una señal de emergencia a la base en tiempo real y activará alarmas en la Central de Monitoreo.</p>
                        
                        <div style="display: flex; gap: 12px;">
                            <button onclick="closeSosConfirm()" class="login-btn" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--text-dim); margin: 0; width: 50%;">Cancelar</button>
                            <button onclick="confirmSOS()" class="login-btn" style="background: #ef4444; color: white; border: none; margin: 0; width: 50%; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">Activar Alerta</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                setTimeout(() => {
                    modal.style.opacity = '1';
                }, 50);
            } else {
                isSos = false;
                updateSOSUI(false);
                speak("Alerta cancelada. Retornando a navegación normal.");
                syncTelemetry();
            }
        };

        window.closeSosConfirm = function() {
            const modal = document.getElementById('sosConfirmModal');
            if (modal) {
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 300);
            }
        };

        window.confirmSOS = function() {
            isSos = true;
            closeSosConfirm();
            updateSOSUI(true);
            speak("Alerta. Señal de auxilio S O S activada. Transmitiendo ubicación satelital a la base de forma prioritaria.");
            syncTelemetry();
        };

        function updateSOSUI(active) {
            const btnMain = document.getElementById('sosBtnMain');
            const btnNav = document.getElementById('sosBtnNav');
            
            if (active) {
                if (btnMain) {
                    btnMain.innerText = 'S.O.S ACTIVO';
                    btnMain.style.background = '#ef4444';
                    btnMain.style.animation = 'statusPulse 0.8s infinite';
                }
                if (btnNav) {
                    btnNav.innerText = 'S.O.S ACTIVO';
                    btnNav.style.background = '#ef4444';
                    btnNav.style.animation = 'statusPulse 0.8s infinite';
                }
            } else {
                if (btnMain) {
                    btnMain.innerText = 'S.O.S';
                    btnMain.style.background = '#ef4444';
                    btnMain.style.animation = 'statusPulse 2s infinite';
                }
                if (btnNav) {
                    btnNav.innerText = 'S.O.S';
                    btnNav.style.background = '#ef4444';
                    btnNav.style.animation = 'statusPulse 1.5s infinite';
                }
            }
        }

        function showRouteCompletionStats() {
            const totalStopsCount = stops.length;
            const today = new Date().toLocaleDateString();
            
            const modal = document.createElement('div');
            modal.id = 'statsModal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.4s ease;
            `;

            modal.innerHTML = `
                <div class="glass-card animate-fade" style="width: 90%; max-width: 420px; padding: 28px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    <div style="background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; box-shadow: 0 0 20px rgba(6, 182, 212, 0.3);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    
                    <span style="font-size: 0.65rem; font-weight: 800; letter-spacing: 2px; color: var(--text-dim); text-transform: uppercase;">Resumen de Jornada</span>
                    <h2 style="font-size: 1.4rem; font-weight: 800; color: white; margin: 4px 0 20px 0; letter-spacing: 0.5px;">¡RUTA COMPLETADA!</h2>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; text-align: left;">
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 12px;">
                            <span style="font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px;">Entregas</span>
                            <div style="font-size: 1.4rem; font-weight: 700; color: white; margin-top: 4px;">${totalStopsCount} / ${totalStopsCount}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 12px;">
                            <span style="font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px;">Efectividad</span>
                            <div style="font-size: 1.4rem; font-weight: 700; color: #10b981; margin-top: 4px;">100%</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 12px;">
                            <span style="font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px;">Fecha</span>
                            <div style="font-size: 0.85rem; font-weight: 700; color: white; margin-top: 8px;">${today}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 12px;">
                            <span style="font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px;">Vehículo</span>
                            <div style="font-size: 0.85rem; font-weight: 700; color: #06b6d4; margin-top: 8px;">Móvil 01 (Admin)</div>
                        </div>
                    </div>

                    <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 20px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 15px;">
                        Reporte sincronizado automáticamente con la central.<br>
                        <span style="color: white; font-weight: 600; letter-spacing: 1px; font-size: 0.65rem;">GUARNIERI NETWORK</span>
                    </div>

                    <button onclick="closeStatsModal()" class="login-btn" style="margin: 0; width: 100%;">Entendido</button>
                </div>
            `;

            document.body.appendChild(modal);

            setTimeout(() => {
                modal.style.opacity = '1';
            }, 50);
        }

        window.closeStatsModal = function() {
            const modal = document.getElementById('statsModal');
            if (modal) {
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 400);
            }
        };

        function showAdminPrompt() {
            if (document.getElementById('adminPromptModal')) return;

            const modal = document.createElement('div');
            modal.id = 'adminPromptModal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.4s ease;
            `;

            modal.innerHTML = `
                <div class="glass-card animate-fade" id="adminPromptCard" style="width: 90%; max-width: 380px; padding: 28px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    <div style="background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; box-shadow: 0 0 15px rgba(6, 182, 212, 0.25);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    
                    <span style="font-size: 0.65rem; font-weight: 800; letter-spacing: 2px; color: var(--text-dim); text-transform: uppercase;">Acceso de Seguridad</span>
                    <h2 style="font-size: 1.2rem; font-weight: 800; color: white; margin: 4px 0 20px 0; letter-spacing: 0.5px;">CONSOLA CENTRAL</h2>
                    
                    <form onsubmit="event.preventDefault(); handleAdminAccess();" style="display: flex; flex-direction: column; width: 100%; text-align: left;">
                        <div class="login-field-container">
                            <label class="login-label">Contraseña de Administrador</label>
                            <input type="password" id="adminPassInput" class="login-input" placeholder="••••••••" style="width: 100%;" required>
                        </div>
                        
                        <p id="adminErrorMsg" style="display: none; color: #ef4444; font-size: 0.75rem; font-weight: 600; margin: -5px 0 15px 0; text-align: center;">Contraseña Incorrecta</p>
                        
                        <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button type="button" onclick="closeAdminPrompt()" class="login-btn" style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--text-dim); margin: 0; width: 50%;">Cancelar</button>
                            <button type="submit" class="login-btn" style="margin: 0; width: 50%; background: linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo));">Acceder</button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            setTimeout(() => {
                modal.style.opacity = '1';
                document.getElementById('adminPassInput').focus();
            }, 50);
        }

        window.closeAdminPrompt = function() {
            const modal = document.getElementById('adminPromptModal');
            if (modal) {
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 400);
            }
        };

        window.handleAdminAccess = async function() {
            const pass = document.getElementById('adminPassInput').value;
            const targetPassHash = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'; // HASH de '1234'
            
            const passHash = await sha256(pass);
            
            if (passHash === targetPassHash) {
                speak("Acceso de administrador autorizado. Abriendo consola central.");
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('username', 'Administrador');
                sessionStorage.setItem('userLogin', 'admin');
                closeAdminPrompt();
                setTimeout(() => {
                    window.location.href = 'central.html';
                }, 500);
            } else {
                const error = document.getElementById('adminErrorMsg');
                error.style.display = 'block';
                
                const card = document.getElementById('adminPromptCard');
                card.style.animation = 'shake 0.4s';
                setTimeout(() => card.style.animation = '', 400);
            }
        };

        function showWelcomeToast(username) {
            const toast = document.createElement('div');
            toast.className = 'welcome-toast glass-card animate-fade';
            toast.style.cssText = `
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(-100px);
                z-index: 9999;
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px 24px;
                border-radius: 16px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.5s ease;
                opacity: 0;
            `;

            toast.innerHTML = `
                <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <div>
                    <h3 style="font-size: 0.95rem; font-weight: 700; color: white; margin: 0; letter-spacing: 0.5px;">¡Bienvenido, ${username}!</h3>
                    <p style="font-size: 0.75rem; color: var(--text-dim); margin: 2px 0 0 0; letter-spacing: 0.2px;">Iniciando sistema logístico y satelital...</p>
                </div>
            `;

            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(0)';
                toast.style.opacity = '1';
            }, 100);

            // Saludo de voz interactivo
            speak(`Bienvenido de vuelta, ${username}. Iniciando sistema de navegación. Que tengas una ruta de entrega segura hoy.`);

            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(-100px)';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }, 3500);
        }

        // Funciones de cifrado bidireccional para contraseñas en LocalStorage
        function cryptPass(text) {
            if (!text) return '';
            return 'ENC:' + btoa(encodeURIComponent(text).split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ 88)).join(''));
        }
        function decryptPass(text) {
            if (!text) return '';
            if (!text.startsWith('ENC:')) return text; // Es texto plano
            try {
                const decodedBase64 = atob(text.substring(4));
                const unxored = decodedBase64.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ 88)).join('');
                return decodeURIComponent(unxored);
            } catch(e) {
                return text; // Fallback
            }
        }

        async function handleLogin() {
            const user = document.getElementById('userInput').value;
            const pass = document.getElementById('passInput').value;
            
            // Descargar usuarios desde Firebase en tiempo real
            let users = [];
            try {
                const snapshot = await database.ref('users').once('value');
                if (snapshot.exists()) {
                    users = snapshot.val();
                    localStorage.setItem('fleet_users', JSON.stringify(users)); // Respaldo local offline
                } else {
                    // Si no existen en la nube (primer inicio), crearlos
                    users = [
                        { username: 'admin', name: 'Administrador', password: cryptPass('1234') },
                        { username: 'conductor1', name: 'Juan Pérez', password: cryptPass('1234') },
                        { username: 'conductor2', name: 'María Gómez', password: cryptPass('1234') }
                    ];
                    await database.ref('users').set(users);
                    localStorage.setItem('fleet_users', JSON.stringify(users));
                }
            } catch (e) {
                console.error("Error al conectar con Firebase (usando caché local):", e);
                const stored = localStorage.getItem('fleet_users');
                if (stored) users = JSON.parse(stored);
            }

            // Encriptar la contraseña ingresada con el cifrado bidireccional
            const passEncoded = cryptPass(pass);

            // Buscar si el usuario y contraseña coinciden
            const matchedUser = users.find(u => u.username.toLowerCase() === user.toLowerCase().trim() && u.password === passEncoded);
            
            if (matchedUser) {
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('username', matchedUser.name);
                sessionStorage.setItem('userLogin', matchedUser.username);
                
                // Mostrar mensaje de bienvenida premium (visual y por voz)
                showWelcomeToast(matchedUser.name);
                syncTelemetry();

                const overlay = document.getElementById('loginOverlay');
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 500);
            } else {
                const error = document.getElementById('loginError');
                error.style.display = 'block';
                // Animación de sacudida
                const card = document.querySelector('.login-card');
                card.style.animation = 'shake 0.4s';
                setTimeout(() => card.style.animation = '', 400);
            }
        }

        async function logout() {
            isSos = false;
            // Indicar desconexión en telemetría antes de limpiar sesión
            const telemetry = JSON.parse(localStorage.getItem('fleet_telemetry_admin') || '{}');
            if (telemetry) {
                telemetry.isOnline = false;
                telemetry.isSos = false;
                telemetry.lastUpdate = new Date().toLocaleTimeString();
                const payload = JSON.stringify(telemetry);
                localStorage.setItem('fleet_telemetry_admin', payload);
                // Transmitir desconexión a Firebase
                database.ref('telemetry/admin_channel').set(telemetry).catch(e => console.error(e));
            }
            sessionStorage.removeItem('isLoggedIn');
            const overlay = document.getElementById('loginOverlay');
            overlay.style.display = 'flex';
            setTimeout(() => overlay.style.opacity = '1', 10);
            
            // Limpiar campos de login
            document.getElementById('userInput').value = '';
            document.getElementById('passInput').value = '';
            document.getElementById('loginError').style.display = 'none';
        }

        function toggleCollapse() {
            const card = document.getElementById('mainCard');
            const icon = document.getElementById('collapseIcon');
            card.classList.toggle('collapsed');
            
            if (card.classList.contains('collapsed')) {
                icon.innerHTML = '<path d="m6 9 6 6 6-6"/>'; // Flecha abajo
            } else {
                icon.innerHTML = '<path d="m18 15-6-6-6 6"/>'; // Flecha arriba
            }
        }
