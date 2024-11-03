const socket = io();
let computers = {};

function addComputer(hostname) {
    if (!computers[hostname]) {
        computers[hostname] = {
            status: 'offline',
            cpu_usage: 0,
            memory_usage: 0,
            disk_usage: 0,
            ip_address: 'N/A',
            anydesk_id: 'N/A'
        };
        updateComputerList();
        updateDashboard();
    }
}

function updateComputerData(data) {
    computers[data.hostname] = data;
    updateDashboard();
}

function updateComputerList() {
    const computerList = document.getElementById('computer-list');
    computerList.innerHTML = '';
    for (const hostname in computers) {
        const computerItem = document.createElement('div');
        computerItem.className = 'computer-item';
        computerItem.textContent = hostname;
        computerList.appendChild(computerItem);
    }
}

function updateDashboard() {
    const hostGrid = document.getElementById('hostGrid');
    hostGrid.innerHTML = '';
    for (const [hostname, data] of Object.entries(computers)) {
        const card = createHostCard(hostname, data);
        hostGrid.appendChild(card);
    }
}

function createHostCard(hostname, data) {
    const card = document.createElement('div');
    card.className = 'host-card';
    card.innerHTML = `
        <h3>${hostname}</h3>
        <span class="status-badge ${data.status}">${data.status}</span>
        <p>CPU: ${data.cpu_usage}%</p>
        <div class="usage-bar">
            <div class="fill" style="width: ${data.cpu_usage}%"></div>
        </div>
        <p>მეხსიერება: ${data.memory_usage}%</p>
        <div class="usage-bar">
            <div class="fill" style="width: ${data.memory_usage}%"></div>
        </div>
        <p>დისკი: ${data.disk_usage}%</p>
        <div class="usage-bar">
            <div class="fill" style="width: ${data.disk_usage}%"></div>
        </div>
        <div class="card-buttons">
            <button class="check-btn" onclick="requestUpdate('${hostname}')">
                <i class="fas fa-sync-alt"></i> შემოწმება
            </button>
            <button class="details-btn" onclick="showDetails('${hostname}')">
                <i class="fas fa-info-circle"></i> დეტალები
            </button>
            <button class="anydesk-btn" onclick="openAnyDesk('${data.anydesk_id}')">
                <i class="fas fa-desktop"></i> AnyDesk
            </button>
        </div>
    `;
    return card;
}

function requestUpdate(hostname) {
    socket.emit('request_update', { hostname: hostname });
}

function showDetails(hostname) {
    const data = computers[hostname];
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${hostname} - დეტალები</h3>
            <div class="details-content">
                <p>სტატუსი: ${data.status}</p>
                <p>CPU: ${data.cpu_usage}%</p>
                <p>მეხსიერება: ${data.memory_usage}%</p>
                <p>დისკი: ${data.disk_usage}%</p>
                <p>IP მისამართი: ${data.ip_address}</p>
                <p>AnyDesk ID: ${data.anydesk_id}</p>
            </div>
            <button onclick="closeModal(this)">დახურვა</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeModal(button) {
    const modal = button.closest('.modal');
    modal.remove();
}

function openAnyDesk(anydeskId) {
    // აქ  შეგიძლიათ დაამატოთ AnyDesk-ის გახსნის ლოგიკა
    console.log(`Opening AnyDesk for ID: ${anydeskId}`);
}

function searchHost() {
    const searchTerm = document.getElementById('hostSearch').value.toLowerCase();
    const hostCards = document.querySelectorAll('.host-card');
    hostCards.forEach(card => {
        const hostname = card.querySelector('h3').textContent.toLowerCase();
        if (hostname.includes(searchTerm)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

document.getElementById('add-hostname-button').addEventListener('click', () => {
    const hostnameInput = document.getElementById('hostname-input');
    const hostname = hostnameInput.value.trim();
    if (hostname) {
        addComputer(hostname);
        hostnameInput.value = '';
    }
});

socket.on('update_computer_data', (data) => {
    updateComputerData(data);
});

// საწყისი მონაცემების ჩატვირთვა
socket.emit('get_computers');

socket.on('initial_computers', (initialComputers) => {
    computers = initialComputers;
    updateDashboard();
});