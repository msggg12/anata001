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
});

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('dashboard-container').style.display = 'flex';
            initializeDashboard();
        } else {
            showError(data.message);
        }
    } catch (error) {
        showError('ავტორიზაციის შეცდომა.');
    }
}

function initializeDashboard() {
    fetchComputers();
}

function addHostname() {
    const hostnameInput = document.getElementById('hostname-input');
    const hostname = hostnameInput.value.trim();

    if (hostname) {
        socket.emit('add_hostname', { hostname });
        hostnameInput.value = '';
        fetchComputers();
    } else {
        showError('გთხოვთ, შეიყვანოთ ჰოსტის სახელი.');
    }
}

async function fetchComputers() {
    try {
        const response = await fetch('/get_computers');
        const data = await response.json();
        updateComputerList(data);
    } catch (error) {
        showError('კომპიუტერების სიის მიღება ვერ მოხერხდა.');
    }
}

function updateComputerList(data) {
    const hostGrid = document.getElementById('hostGrid');
    hostGrid.innerHTML = '';

    for (const hostname in data) {
        const computerCard = createComputerCard(hostname, data[hostname]);
        hostGrid.appendChild(computerCard);
    }
}

function createComputerCard(hostname, data) {
    const card = document.createElement('div');
    card.className = 'host-card';
    card.innerHTML = `
        <h3>${hostname}</h3>
        <span class="status-badge ${data.status}">${data.status}</span>
        <div class="usage-info">
            <p>CPU: ${data.cpu_usage}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.cpu_usage}%"></div></div>
            <p>RAM: ${data.memory_usage}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.memory_usage}%"></div></div>
            <p>Disk: ${data.disk_usage}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.disk_usage}%"></div></div>
        </div>
        <div class="card-buttons">
            <button class="edit-button" onclick="editHostname('${hostname}')">რედაქტირება</button>
            <button class="delete-button" onclick="deleteHostname('${hostname}')">წაშლა</button>
            <button class="info-button" onclick="requestComputerData('${hostname}')">ინფორმაცია</button>
        </div>
    `;
    return card;
}

function editHostname(oldHostname) {
    const newHostname = prompt('შეიყვანეთ ახალი ჰოსტის სახელი:', oldHostname);
    if (newHostname && newHostname !== oldHostname) {
        socket.emit('edit_hostname', {
            oldHostname: oldHostname,
            newHostname: newHostname
        });
        fetchComputers();
    }
}

function deleteHostname(hostname) {
    if (confirm(`დარწმუნებული ხართ, რომ გსურთ წაშალოთ ${hostname}?`)) {
        socket.emit('delete_hostname', { hostname });
        fetchComputers();
    }
}

function requestComputerData(hostname) {
    socket.emit('request_data', { hostname });

    const computers = document.querySelectorAll('.host-card');
    let computerData;

    computers.forEach(card => {
        if (card.querySelector('h3').textContent === hostname) {
            const status = card.querySelector('.status-badge').textContent;
            const cpu = card.querySelector('.usage-info p:nth-child(1)').textContent;
            const ram = card.querySelector('.usage-info p:nth-child(3)').textContent;
            const disk = card.querySelector('.usage-info p:nth-child(5)').textContent;

            computerData = {
                hostname: hostname,
                data: {
                    status: status,
                    cpu_usage: cpu.replace('CPU: ', '').replace('%', ''),
                    memory_usage: ram.replace('RAM: ', '').replace('%', ''),
                    disk_usage: disk.replace('Disk: ', '').replace('%', ''),
                    ip_address: 'N/A',
                    anydesk_id: 'N/A'
                }
            };
        }
    });

    if (computerData) {
        socket.emit('request_data_for_host', computerData);
    }
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.classList.add('fade-in');

    setTimeout(() => {
        errorMessage.classList.remove('fade-in');
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 500);
    }, 5000);
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

// Socket event listeners
socket.on('update_computer_list', (data) => {
    updateComputerList(data);
});

socket.on('request_data_for_host', (data) => {
    const computerData = document.getElementById('computer-data');
    computerData.innerHTML = `
        <h3>${data.hostname} - დეტალური ინფორმაცია</h3>
        <p>სტატუსი: ${data.data.status}</p>
        <p>CPU გამოყენება: ${data.data.cpu_usage}%</p>
        <p>მეხსიერების გამოყენება: ${data.data.memory_usage}%</p>
        <p>დისკის გამოყენება: ${data.data.disk_usage}%</p>
        <p>IP მისამართი: ${data.data.ip_address}</p>
        <p>AnyDesk ID: ${data.data.anydesk_id}</p>
    `;
    computerData.classList.add('fade-in');
});

socket.on('error', (data) => {
    showError(data.message);
});

socket.on('hostname_updated', (data) => {
    fetchComputers();
});

socket.on('hostname_deleted', (data) => {
    fetchComputers();
});
