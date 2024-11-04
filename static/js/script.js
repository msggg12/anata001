const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    const addButton = document.getElementById('add-hostname-button');
    const submitButton = document.getElementById('submit-hostname');
    const hostnameInput = document.getElementById('hostname-input');
    const addComputerSection = document.getElementById('add-computer');
    const darkModeToggle = document.getElementById('dark-mode-toggle');

    if (addButton && submitButton && hostnameInput && addComputerSection) {
        addButton.addEventListener('click', () => {
            addComputerSection.style.display = 'flex';
            addButton.style.display = 'none';
        });

        submitButton.addEventListener('click', addHostname);
        hostnameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addHostname();
            }
        });
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    fetchComputers();

    // Listen for updates from the server
    socket.on('update_computer_list', (updatedComputers) => {
        updateComputerList(updatedComputers);
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
    try {
        const response = await fetch('/get_computers');
        const data = await response.json();
        if (data.success === false) {
            throw new Error(data.message);
        }
        updateComputerList(data);
    } catch (error) {
        console.error("Error fetching computers:", error);
        showError('კომპიუტერების სიის მიღება ვერ მოხერხდა.');
    }
}

function updateComputerList(data) {
    const hostGrid = document.getElementById('hostGrid');
    hostGrid.innerHTML = '';

    if (Object.keys(data).length === 0) {
        hostGrid.innerHTML = '<p>კომპიუტერები ვერ მოიძებნა.</p>';
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
                    <a href="#" onclick="editHostname('${hostname}')">რედაქტირება</a>
                    <a href="#" onclick="deleteHostname('${hostname}')">წაშლა</a>
                </div>
            </div>
        </div>
        <span class="status-badge ${status}">${status === 'online' ? 'ონლაინ' : 'ოფლაინ'}</span>
        <div class="usage-info">
            <p>CPU: ${data.cpu_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.cpu_usage || 0}%"></div></div>
            <p>RAM: ${data.memory_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.memory_usage || 0}%"></div></div>
            <p>დისკი: ${data.disk_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.disk_usage || 0}%"></div></div>
        </div>
        <p>IP: ${data.ip_address || 'N/A'}</p>
        <p>AnyDesk ID: ${data.anydesk_id || 'N/A'}</p>
        <div class="card-buttons">
            <button class="check-btn" onclick="checkHost('${hostname}')">შემოწმება</button>
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
    const addComputerSection = document.getElementById('add-computer');
    const addButton = document.getElementById('add-hostname-button');
    const hostname = hostnameInput.value.trim();
    if (hostname) {
        socket.emit('add_hostname', { hostname });
        hostnameInput.value = ''; // გასუფთავება
        addComputerSection.style.display = 'none';
        addButton.style.display = 'inline-block';
    } else {
        showError("გთხოვთ, შეიყვანოთ ჰოსტის სახელი.");
    }
}

function editHostname(oldHostname) {
    const newHostname = prompt('შეიყვანეთ ახალი ჰოსტის სახელი:', oldHostname);
    if (newHostname && newHostname !== oldHostname) {
        socket.emit('edit_hostname', { oldHostname, newHostname });
    }
}

function deleteHostname(hostname) {
    if (confirm(`დარწმუნებული ხართ, რომ გსურთ წაშალოთ ${hostname}?`)) {
        socket.emit('delete_hostname', { hostname });
    }
}

function connectToAnyDesk(anydesk_id) {
    if (anydesk_id) {
        const url = `anydesk:${anydesk_id}`;
        window.open(url);
    } else {
        alert('AnyDesk ID არ არის ხელმისაწვდომი.');
    }
}

function checkHost(hostname) {
    console.log(`ჰოსტის შემოწმება: ${hostname}`);
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

// შემოწმება შენახული მუქი რეჟიმის პრეფერენციისთვის
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    updateDarkModeButton();
}