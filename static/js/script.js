const socket = io();
let isLoading = false;

document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('dark-mode-toggle');

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    fetchComputers();

    socket.on('update_computer_list', (encryptedComputers) => {
        try {
            const decryptedData = JSON.parse(decryptData(encryptedComputers));
            console.log("Received updated computer list:", decryptedData);
            updateComputerList(decryptedData);
        } catch (error) {
            console.error("Error updating computer list:", error);
            showError('Failed to update the computer list.');
        }
    });
});

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    updateDarkModeButton();
}

function updateDarkModeButton() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        const icon = darkModeToggle.querySelector('i');
        if (document.body.classList.contains('dark-mode')) {
            icon.classList.replace('fa-moon', 'fa-sun');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
        }
    }
}

async function fetchComputers() {
    if (isLoading) return;
    isLoading = true;

    try {
        console.log("Fetching computers...");
        const response = await fetch('/get_computers');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const encryptedData = await response.text();
        console.log("Received encrypted data:", encryptedData);
        if (!encryptedData) {
            throw new Error('Received empty data');
        }

        const decryptedData = JSON.parse(decryptData(encryptedData));
        console.log("Decrypted data:", decryptedData);
        updateComputerList(decryptedData);
    } catch (error) {
        console.error("Error fetching computers:", error);
        showError('Failed to retrieve computer list.');
    } finally {
        isLoading = false;
    }
}

function updateComputerList(data) {
    console.log("Updating computer list with data:", data);
    const hostGrid = document.getElementById('hostGrid');
    hostGrid.innerHTML = '';

    if (typeof data !== 'object' || Object.keys(data).length === 0) {
        console.log("No computers found or invalid data.");
        hostGrid.innerHTML = '<p>No computers found.</p>';
        return;
    }

    for (const hostname in data) {
        if (data.hasOwnProperty(hostname) && hostname) {
            console.log(`Processing ${hostname}:`, data[hostname]);
            const computerData = {
                ...data[hostname].static,
                ...data[hostname].dynamic
            };
            const computerCard = createComputerCard(hostname, computerData);
            if (computerCard) {
                hostGrid.appendChild(computerCard);
            } else {
                console.log(`Failed to create card for ${hostname}`);
            }
        }
    }
}

function createComputerCard(hostname, data) {
    console.log("Creating card:", hostname, data);
    if (!hostname) {
        console.error("Attempt to create card for empty hostname");
        return null;
    }

    const card = document.createElement('div');
    card.className = 'host-card';
    const status = determineStatus(data);
    card.innerHTML = `
        <div class="card-header">
            <h3><i class="fas fa-desktop"></i> ${hostname}</h3>
            <div class="dropdown">
                <button class="dropbtn"><i class="fas fa-ellipsis-v"></i></button>
                <div class="dropdown-content">
                    <a href="#" onclick="restartHost('${hostname}')"><i class="fas fa-redo"></i> Restart</a>
                    <a href="#" onclick="deleteHost('${hostname}')"><i class="fas fa-trash"></i> Delete</a>
                    <a href="#" onclick="showHostInfo('${hostname}')"><i class="fas fa-info-circle"></i> Info</a>
                </div>
            </div>
        </div>
        <span class="status-badge ${status}"><i class="fas fa-${status === 'online' ? 'check-circle' : 'times-circle'}"></i> ${status === 'online' ? 'Online' : 'Offline'}</span>
        <div class="usage-info">
            <p><i class="fas fa-microchip"></i> CPU: ${data.cpu_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.cpu_usage || 0}%"></div></div>
            <p><i class="fas fa-memory"></i> RAM: ${data.memory_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.memory_usage || 0}%"></div></div>
            <p><i class="fas fa-hdd"></i> Disk: ${data.disk_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.disk_usage || 0}%"></div></div>
        </div>
        <p><i class="fas fa-network-wired"></i> IP: ${data.ip_address || 'N/A'}</p>
        <p><i class="fas fa-id-badge"></i> AnyDesk ID: ${data.anydesk_id || 'N/A'}</p>
        <div class="card-buttons">
            <button class="check-btn" onclick="checkHost('${hostname}')"><i class="fas fa-sync"></i> Check</button>
            <button class="anydesk-btn" onclick="connectToAnyDesk('${data.anydesk_id || ''}')"><i class="fas fa-desktop"></i> AnyDesk</button>
        </div>
    `;
    console.log("Created card:", card);
    return card;
}

function determineStatus(data) {
    if (!data.last_update) return 'offline';
    const lastUpdateTime = new Date(data.last_update).getTime();
    const currentTime = new Date().getTime();
    const timeDifference = currentTime - lastUpdateTime;
    return timeDifference > 5 * 60 * 1000 ? 'offline' : 'online';
}

function restartHost(hostname) {
    if (confirm(`Are you sure you want to restart ${hostname}?`)) {
        console.log(`Restarting host: ${hostname}`);
        socket.emit('restart_host', encryptData(JSON.stringify({ hostname })));
    }
}

function connectToAnyDesk(anydesk_id) {
    if (anydesk_id) {
        const url = `anydesk:${anydesk_id}`;
        window.open(url);
    } else {
        alert('AnyDesk ID is not available.');
    }
}

function checkHost(hostname) {
    console.log(`Checking host: ${hostname}`);
    socket.emit('check_host', encryptData(JSON.stringify({ hostname })));
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    } else {
        console.error(message);
    }
}

function searchHost() {
    const searchTerm = document.getElementById('hostSearch').value.toLowerCase();
    const hostCards = document.querySelectorAll('.host-card');

    hostCards.forEach(card => {
        const hostname = card.querySelector('h3').textContent.toLowerCase();
        card.style.display = hostname.includes(searchTerm) ? 'block' : 'none';
    });
}

function deleteHost(hostname) {
    if (confirm(`Are you sure you want to delete ${hostname}?`)) {
        console.log(`Deleting host: ${hostname}`);
        socket.emit('delete_host', encryptData(JSON.stringify({ hostname })));
    }
}

function showHostInfo(hostname) {
    console.log(`Showing info for host: ${hostname}`);
    alert(`Host info: ${hostname}\nAdditional details will be available soon.`);
}

if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    updateDarkModeButton();
}

setInterval(fetchComputers, 30000);

// Encryption and decryption functions (client-side simulation)
function encryptData(data) {
    return btoa(data);
}

function decryptData(encryptedData) {
    try {
        return atob(encryptedData);
    } catch (error) {
        console.error("Decryption error:", error);
        return '';
    }
}
