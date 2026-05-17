// Array global de usuarios
        let users = [];
        
        // Estado de edición
        let isEditMode = false;
        let editTargetUsername = '';

        // Variable para controlar usuario a borrar
        let deleteTargetUsername = '';

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


        // Comprobación de seguridad de sesión al cargar
        function checkAdminSession() {
            // El usuario debe estar autenticado
            if (sessionStorage.getItem('isLoggedIn') !== 'true') {
                window.location.href = 'index.html';
                return false;
            }
            return true;
        }

        // Cargar usuarios de Firebase en tiempo real
        async function loadUsers() {
            try {
                database.ref('users').on('value', (snapshot) => {
                    if (snapshot.exists()) {
                        users = snapshot.val() || [];
                    } else {
                        // Inicializar con valores por defecto en la nube
                        users = [
                            { username: 'admin', name: 'Administrador', password: cryptPass('1234') },
                            { username: 'conductor1', name: 'Juan Pérez', password: cryptPass('1234') },
                            { username: 'conductor2', name: 'María Gómez', password: cryptPass('1234') }
                        ];
                        saveUsersToStorage();
                    }
                    renderUsers();
                });
            } catch (e) {
                console.error("Error al cargar usuarios:", e);
                showToast("Error al conectar con la base de datos de usuarios", "error");
            }
        }

        // Guardar usuarios en Firebase
        async function saveUsersToStorage() {
            try {
                await database.ref('users').set(users);
            } catch (e) {
                console.error("Error al guardar usuarios:", e);
                showToast("Error al guardar cambios en la nube", "error");
            }
        }

        // Renderizar lista en HTML
        function renderUsers(filterQuery = '') {
            const container = document.getElementById('usersListContainer');
            const query = filterQuery.toLowerCase().trim();
            
            const filteredUsers = users.filter(u => 
                u.name.toLowerCase().includes(query) || 
                u.username.toLowerCase().includes(query)
            );

            document.getElementById('userCountBadge').innerText = filteredUsers.length;

            if (filteredUsers.length === 0) {
                container.innerHTML = `
                    <div class="empty-users-card">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p>No se encontraron usuarios registrados.</p>
                    </div>
                `;
                return;
            }

            let html = '';
            filteredUsers.forEach(u => {
                // Obtener iniciales para el avatar
                const initials = u.name.split(' ')
                                      .map(w => w.charAt(0))
                                      .slice(0, 2)
                                      .join('');

                // Determinar si es un admin o un conductor regular para estilos visuales
                const isAdmin = u.username.toLowerCase() === 'admin';
                const avatarGradient = isAdmin 
                    ? 'linear-gradient(135deg, var(--accent-orange), #ea580c)' 
                    : 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))';
                
                const avatarShadow = isAdmin
                    ? 'rgba(249, 115, 22, 0.25)'
                    : 'rgba(79, 70, 229, 0.2)';

                html += `
                    <div class="user-item-card">
                        <div class="user-profile-info">
                            <div class="user-avatar-badge" style="background: ${avatarGradient}; box-shadow: 0 4px 10px ${avatarShadow};">
                                ${initials}
                            </div>
                            <div class="user-details">
                                <span class="user-name-title">${u.name}</span>
                                <div class="user-login-sub">
                                    <span>👤 ${u.username}</span>
                                    <span>•</span>
                                    <div class="password-reveal-wrapper">
                                        <span>🔑</span>
                                        <span class="password-reveal-text" id="reveal-${u.username}">${decryptPass(u.password)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="user-actions">
                            <button onclick="editUser('${u.username}')" class="action-icon-btn edit-btn" title="Modificar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button onclick="promptDeleteUser('${u.username}')" class="action-icon-btn delete-btn" title="Eliminar" ${isAdmin ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
        }

        // Manejar el submit del formulario
        async function handleFormSubmit() {
            const name = document.getElementById('inputName').value.trim();
            const username = document.getElementById('inputUsername').value.trim().toLowerCase();
            const password = document.getElementById('inputPassword').value;

            if (!name || !username || !password) {
                showToast("Por favor complete todos los campos", "error");
                return;
            }

            if (isEditMode) {
                // Modo Edición
                const userIndex = users.findIndex(u => u.username === editTargetUsername);
                if (userIndex !== -1) {
                    users[userIndex].name = name;
                    // Guardar la contraseña encriptada bidireccionalmente
                    if (password) {
                        users[userIndex].password = cryptPass(password);
                    }
                    saveUsersToStorage();
                    speakSystem(`Usuario ${name} modificado correctamente.`);
                    showToast("Usuario modificado con éxito", "success");
                    cancelEditMode();
                    renderUsers();
                } else {
                    showToast("Error: No se encontró el usuario a modificar", "error");
                }
            } else {
                // Modo Creación
                // Cifrar la contraseña ingresada bidireccionalmente
                const hashedPassword = cryptPass(password);
                
                // Comprobar si el username ya existe
                const exists = users.some(u => u.username === username);
                if (exists) {
                    const card = document.querySelector('.glass-card');
                    card.classList.add('animate-shake');
                    setTimeout(() => card.classList.remove('animate-shake'), 400);
                    showToast("El nombre de usuario ya está registrado", "error");
                    return;
                }

                // Crear usuario
                const newUser = { username, name, password: hashedPassword };
                users.push(newUser);
                saveUsersToStorage();
                speakSystem(`Usuario ${name} creado con éxito.`);
                showToast("Usuario registrado con éxito", "success");
                
                // Limpiar formulario
                document.getElementById('userForm').reset();
                renderUsers();
            }
        }

        // Cargar un usuario en el formulario para editarlo
        window.editUser = function(username) {
            const user = users.find(u => u.username === username);
            if (!user) return;

            isEditMode = true;
            editTargetUsername = username;

            // Rellenar formulario
            document.getElementById('inputName').value = user.name;
            document.getElementById('inputUsername').value = user.username;
            document.getElementById('inputUsername').readOnly = true; // El username es identificador único
            document.getElementById('inputPassword').value = decryptPass(user.password);
            document.getElementById('inputPassword').placeholder = 'Ingresar contraseña';

            // Cambiar textos y botones del panel
            document.getElementById('formPanelTitle').innerText = "Modificar Usuario";
            document.getElementById('btnSubmitText').innerText = "Guardar Cambios";
            document.getElementById('btnSubmitForm').style.background = "linear-gradient(135deg, var(--accent-green) 0%, var(--accent-cyan) 100%)";
            document.getElementById('btnSubmitForm').style.boxShadow = "0 4px 15px rgba(16, 185, 129, 0.25)";
            document.getElementById('btnCancelEdit').style.display = "block";

            // Scroll suave hacia el formulario en móviles
            document.querySelector('.dashboard-grid').scrollIntoView({ behavior: 'smooth' });
            
            showToast(`Modificando a ${user.name}`, "info");
        };

        // Cancelar modo de edición
        window.cancelEditMode = function() {
            isEditMode = false;
            editTargetUsername = '';

            // Limpiar formulario y quitar solo-lectura
            document.getElementById('userForm').reset();
            document.getElementById('inputUsername').readOnly = false;
            document.getElementById('inputPassword').placeholder = 'Ingresar contraseña';

            // Reestablecer títulos y botones
            document.getElementById('formPanelTitle').innerText = "Crear Nuevo Usuario";
            document.getElementById('btnSubmitText').innerText = "Crear Usuario";
            document.getElementById('btnSubmitForm').style.background = "linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-indigo) 100%)";
            document.getElementById('btnSubmitForm').style.boxShadow = "0 4px 15px rgba(6, 182, 212, 0.25)";
            document.getElementById('btnCancelEdit').style.display = "none";
        };

        // Mostrar confirmación elegante antes de borrar
        window.promptDeleteUser = function(username) {
            const user = users.find(u => u.username === username);
            if (!user) return;

            // Evitar borrar administrador principal
            if (username.toLowerCase() === 'admin') {
                showToast("El administrador principal no puede ser eliminado", "error");
                return;
            }

            deleteTargetUsername = username;
            document.getElementById('deleteModalName').innerText = user.name;
            
            // Mostrar modal
            const overlay = document.getElementById('deleteModalOverlay');
            overlay.classList.add('active');
        };

        // Cerrar modal
        window.closeDeleteModal = function() {
            const overlay = document.getElementById('deleteModalOverlay');
            overlay.classList.remove('active');
            deleteTargetUsername = '';
        };

        // Confirmar eliminación del usuario
        document.getElementById('btnConfirmDelete').addEventListener('click', () => {
            if (!deleteTargetUsername) return;

            const userIndex = users.findIndex(u => u.username === deleteTargetUsername);
            if (userIndex !== -1) {
                const deletedName = users[userIndex].name;
                users.splice(userIndex, 1);
                saveUsersToStorage();
                
                speakSystem(`Usuario ${deletedName} eliminado.`);
                showToast("Usuario eliminado correctamente", "success");
                
                // Si el usuario borrado estaba cargado en el formulario de edición, cancelarlo
                if (isEditMode && editTargetUsername === deleteTargetUsername) {
                    cancelEditMode();
                }

                closeDeleteModal();
                renderUsers();
            }
        });

        // Filtrado en vivo de búsqueda
        window.handleSearch = function(value) {
            renderUsers(value);
        };

        // Navegar hacia atrás con animación y voz
        window.navigateBack = function() {
            speakSystem("Retornando a la central de monitoreo.");
            setTimeout(() => {
                window.location.href = 'central.html';
            }, 500);
        };

        // Visualización de contraseña toggle
        window.togglePasswordVisibility = function(inputId, iconId) {
            const input = document.getElementById(inputId);
            const icon = document.getElementById(iconId);
            
            if (input.type === "password") {
                input.type = "text";
                icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
            } else {
                input.type = "password";
                icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
            }
        };

        // Toast Notification System
        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const item = document.createElement('div');
            
            let iconSvg = '';
            if (type === 'success') {
                iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${window.getComputedStyle(document.documentElement).getPropertyValue('--accent-green')}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
            } else if (type === 'error') {
                iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${window.getComputedStyle(document.documentElement).getPropertyValue('--accent-red')}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
            } else {
                iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${window.getComputedStyle(document.documentElement).getPropertyValue('--accent-cyan')}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
            }

            item.className = `toast-item ${type} glass-card`;
            item.innerHTML = `
                <div class="toast-icon">${iconSvg}</div>
                <div>${message}</div>
            `;
            
            container.appendChild(item);
            
            // Forzar reflow para animación
            setTimeout(() => item.classList.add('active'), 10);
            
            // Auto borrar
            setTimeout(() => {
                item.classList.remove('active');
                setTimeout(() => item.remove(), 400);
            }, 3000);
        }

        // Sintetizador de voz
        function speakSystem(text) {
            if (typeof SpeechSynthesisUtterance !== 'undefined') {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'es-ES';
                utterance.rate = 1.0;
                window.speechSynthesis.speak(utterance);
            }
        }

        // Inicialización al cargar la ventana
        window.onload = async () => {
            if (checkAdminSession()) {
                await loadUsers();
                renderUsers();
                speakSystem("Panel de gestión de usuarios cargado.");
            }
        };