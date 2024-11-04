const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    const addButton = document.getElementById('add-hostname-button');
    const hostnameInput = document.getElementById('hostname-input');

    if (addButton && hostnameInput) {
        addButton.addEventListener('click', addHostname);
        hostnameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addHostname();
            }
        });
    }

    fetchComputers();

    // Listen for updates from the server
    socket.on('update_computer_list', (updatedComputers) => {
        updateComputerList(updatedComputers);
    });
});

async function fetchComputers() {
    try {
        const response = await fetch('/get_computers');
        const data = await response.json();
        if (data.success === false) {
            throw new Error(data.message);
        }
        updateComputerList(data);
    } catch (error) {
        console.error("Error fetching computers:", error);
        showError('Unable to fetch the list of computers.');
    }
}

function updateComputerList(data) {
    const hostGrid = document.getElementById('hostGrid');
    hostGrid.innerHTML = '';

    if (Object.keys(data).length === 0) {
        hostGrid.innerHTML = '<p>No computers found.</p>';
        return;
    }

    for (const hostname in data) {
        const computerCard = createComputerCard(hostname, data[hostname]);
        hostGrid.appendChild(computerCard);
    }
}

function createComputerCard(hostname, data) {
    const card = document.createElement('div');
    card.className = 'host-card';
    const status = determineStatus(data);
    card.innerHTML = `
        <div class="card-header">
            <h3>${hostname}</h3>
            <div class="dropdown">
                <button class="dropbtn"><i class="fas fa-ellipsis-v"></i></button>
                <div class="dropdown-content">
                    <a href="#" onclick="editHostname('${hostname}')">Edit</a>
                    <a href="#" onclick="deleteHostname('${hostname}')">Delete</a>
                </div>
            </div>
        </div>
        <span class="status-badge ${status}">${status}</span>
        <div class="usage-info">
            <p>CPU: ${data.cpu_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.cpu_usage || 0}%"></div></div>
            <p>RAM: ${data.memory_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.memory_usage || 0}%"></div></div>
            <p>Disk: ${data.disk_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.disk_usage || 0}%"></div></div>
        </div>
        <p>IP: ${data.ip_address || 'N/A'}</p>
        <p>AnyDesk ID: ${data.anydesk_id || 'N/A'}</p>
        <div class="card-buttons">
            <button class="check-btn" onclick="checkHost('${hostname}')">Check</button>
            <button class="anydesk-btn" onclick="connectToAnyDesk('${data.anydesk_id || ''}')">AnyDesk</button>
        </div>
    `;
    return card;
}

function determineStatus(data) {
    if (!data.last_update) return 'offline';
    const lastUpdateTime = new Date(data.last_update).getTime();
    const currentTime = new Date().getTime();
    const timeDifference = currentTime - lastUpdateTime;
    return timeDifference > 5 * 60 * 1000 ? 'offline' : 'online';
}

function addHostname() {
    const hostnameInput = document.getElementById('hostname-input');
    const hostname = hostnameInput.value.trim();
    if (hostname) {
        socket.emit('join', { hostname });
        hostnameInput.value = ''; // Clear input
    } else {
        showError("Please enter a hostname.");
    }
}

function editHostname(oldHostname) {
    const newHostname = prompt('Enter new hostname:', oldHostname);
    if (newHostname && newHostname !== oldHostname) {
        socket.emit('edit_hostname', { oldHostname, newHostname });
    }
}

function deleteHostname(hostname) {
    if (confirm(`Are you sure you want to delete ${hostname}?`)) {
        socket.emit('delete_hostname', { hostname });
    }
}

function connectToAnyDesk(anydesk_id) {
    if (anydesk_id) {
        const url = `anydesk:${anydesk_id}`;
        window.open(url);
    } else {
        alert('No AnyDesk ID available.');
    }
}

function checkHost(hostname) {
    // Implement the check host functionality here
    console.log(`Checking host: ${hostname}`);
    // You can emit a socket event to request updated information from the server
    socket.emit('check_host', { hostname });
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