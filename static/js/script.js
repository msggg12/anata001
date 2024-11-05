const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchComputers();
    setupSocketListeners();
    applyDarkModeSetting();
    setInterval(fetchComputers, 30000);
});

function setupEventListeners() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const searchInput = document.getElementById('hostSearch');
    const modal = document.getElementById('hostInfoModal');
    const closeBtn = modal.querySelector('.close');

    darkModeToggle?.addEventListener('click', toggleDarkMode);
    searchInput?.addEventListener('input', searchHost);

    closeBtn.onclick = () => { modal.style.display = "none"; };
    window.onclick = (event) => { if (event.target == modal) modal.style.display = "none"; };
}

function setupSocketListeners() {
    socket.on('update_computer_list', (updatedComputers) => {
        try {
            console.log("მიღებულია განახლებული კომპიუტერების სია:", updatedComputers);
            updateComputerList(updatedComputers);
        } catch (error) {
            console.error("შეცდომა კომპიუტერების სიის განახლებისას:", error);
            showError('კომპიუტერების სიის განახლება ვერ მოხერხდა.');
        }
    });

    socket.on('check_result', (result) => {
        showHostInfo(result.hostname, result.info);
    });
}

async function fetchComputers() {
    try {
        const response = await fetch('/get_computers');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        updateComputerList(data);
    } catch (error) {
        console.error("შეცდომა კომპიუტერების მიღებისას:", error);
        showError('კომპიუტერების სიის მიღება ვერ მოხერხდა.');
    }
}

function updateComputerList(data) {
    const hostGrid = document.getElementById('hostGrid');
    hostGrid.innerHTML = '';

    if (!data || Object.keys(data).length === 0) {
        hostGrid.innerHTML = '<p>კომპიუტერები ვერ მოიძებნა.</p>';
        return;
    }

    for (const hostname in data) {
        const computerData = { ...data[hostname].static, ...data[hostname].dynamic };
        const computerCard = createComputerCard(hostname, computerData);
        if (computerCard) hostGrid.appendChild(computerCard);
    }
}

function createComputerCard(hostname, data) {
    const card = document.createElement('div');
    card.className = 'host-card';
    card.dataset.hostname = hostname;
    const status = determineStatus(data);

    card.innerHTML = `
        <div class="card-header">
            <h3><i class="fas fa-desktop"></i> ${hostname}</h3>
            ${createDropdown(hostname)}
        </div>
        <span class="status-badge ${status}"><i class="fas fa-${status === 'online' ? 'check-circle' : 'times-circle'}"></i> ${status === 'online' ? 'ონლაინ' : 'ოფლაინ'}</span>
        ${createUsageInfo(data)}
        <p><i class="fas fa-network-wired"></i> IP: ${data.ip_address || 'N/A'}</p>
        <p><i class="fas fa-id-badge"></i> AnyDesk ID: ${data.anydesk_id || 'N/A'}</p>
        <div class="card-buttons">
            <button class="check-btn" onclick="checkHost('${hostname}')"><i class="fas fa-sync"></i> შემოწმება</button>
            <button class="anydesk-btn" onclick="connectToAnyDesk('${data.anydesk_id || ''}')"><i class="fas fa-desktop"></i> AnyDesk</button>
        </div>
    `;
    card.dataset.lastUpdate = data.last_update || '';
    return card;
}

function createDropdown(hostname) {
    return `
        <div class="dropdown">
            <button class="dropbtn"><i class="fas fa-ellipsis-v"></i></button>
            <div class="dropdown-content">
                <a href="#" onclick="restartHost('${hostname}')"><i class="fas fa-redo"></i> გადატვირთვა</a>
                <a href="#" onclick="deleteHost('${hostname}')"><i class="fas fa-trash"></i> წაშლა</a>
                <a href="#" onclick="showHostInfo('${hostname}')"><i class="fas fa-info-circle"></i> ინფორმაცია</a>
            </div>
        </div>
    `;
}

function createUsageInfo(data) {
    return `
        <div class="usage-info">
            <p><i class="fas fa-microchip"></i> CPU: ${getColoredPercentage(data.cpu_usage)}</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.cpu_usage || 0}%"></div></div>
            <p><i class="fas fa-memory"></i> RAM: ${getColoredPercentage(data.memory_usage)}</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.memory_usage || 0}%"></div></div>
            <p><i class="fas fa-hdd"></i> დისკი: ${getColoredPercentage(data.disk_usage)}</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.disk_usage || 0}%"></div></div>
        </div>
    `;
}

function getColoredPercentage(value) {
    if (value === undefined || value === null) return 'N/A';
    const percentage = parseFloat(value);
    const color = percentage > 80 ? 'red' : percentage > 50 ? 'yellow' : 'green';
    return `<span style="color: ${color}">${percentage}%</span>`;
}

function determineStatus(data) {
    const lastUpdateTime = new Date(data.last_update || 0).getTime();
    const timeDifference = Date.now() - lastUpdateTime;
    return timeDifference > 5 * 60 * 1000 ? 'offline' : 'online';
}

function restartHost(hostname) {
    if (confirm(`დარწმუნებული ხართ, რომ გსურთ გადატვირთოთ ${hostname}?`)) {
        socket.emit('restart_host', { hostname });
    }
}

function deleteHost(hostname) {
    if (confirm(`დარწმუნებული ხართ, რომ გსურთ წაშალოთ ${hostname}?`)) {
        socket.emit('delete_host', { hostname });
    }
}

function checkHost(hostname) {
    socket.emit('check_host', { hostname });
    showMessage(`მიმდინარეობს ${hostname}-ის შემოწმება...`);
}

function connectToAnyDesk(anydesk_id) {
    if (anydesk_id) window.open(`anydesk:${anydesk_id}`);
    else alert('AnyDesk ID არ არის ხელმისაწვდომი.');
}

function showHostInfo(hostname, info = null) {
    if (info) {
        displayHostInfo(hostname, info);
    } else {
        fetch(`/get_host_info/${hostname}`)
            .then(response => response.json())
            .then(data => data.success ? displayHostInfo(hostname, data.info) : alert('ვერ მოხერხდა ჰოსტის ინფორმაციის მიღება'))
            .catch(error => {
                console.error('შეცდომა ჰოსტის ინფორმაციის მიღებისას:', error);
                alert('შეცდომა ჰოსტის ინფორმაციის მიღებისას');
            });
    }
}

function displayHostInfo(hostname, info) {
    const infoHTML = `
        <h2>${hostname}</h2>
        <p>CPU: ${getColoredPercentage(info.dynamic.cpu_usage)}</p>
        <p>RAM: ${getColoredPercentage(info.dynamic.memory_usage)}</p>
        <p>დისკი: ${getColoredPercentage(info.dynamic.disk_usage)}</p>
        <p>მყარი დისკის საერთო მოცულობა: ${formatBytes(info.static.disk_space_total)}</p>
        <p>ოპერატიული მეხსიერება: ${formatBytes(info.static.memory_total)}</p>
        <p>პროცესორი: ${info.static.cpu_info || 'N/A'}</p>
        <p>IP მისამართი: ${info.static.ip_address}</p>
        <p>AnyDesk ID: ${info.static.anydesk_id}</p>
        <p>ბოლო განახლება: ${new Date(info.dynamic.last_update).toLocaleString()}</p>
    `;
    document.getElementById('hostInfoContent').innerHTML = infoHTML;
    document.getElementById('hostInfoModal').style.display = "block";
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = Math.max(0, decimals);
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

function applyDarkModeSetting() {
    if (localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark-mode');
}

function searchHost(event) {
    const searchTerm = event.target.value.toLowerCase();
    const hostCards = document.querySelectorAll('.host-card');
    hostCards.forEach(card => {
        const hostname = card.querySelector('h3').textContent.toLowerCase();
        card.style.display = hostname.includes(searchTerm) ? '' : 'none';
    });
}

function showError(message) {
    const errorMessage = document.createElement('div');
    errorMessage.classList.add('error-message');
    errorMessage.innerText = message;
    document.body.appendChild(errorMessage);
    setTimeout(() => errorMessage.remove(), 3000);
}

function showMessage(message) {
    const messageBox = document.createElement('div');
    messageBox.classList.add('message-box');
    messageBox.innerText = message;
    document.body.appendChild(messageBox);
    setTimeout(() => messageBox.remove(), 3000);

}

