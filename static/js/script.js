const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchComputers();
    setupSocketListeners();
    applyDarkModeSetting();
    setInterval(fetchComputers, 30000); // ავტომატურად განაახლეთ კომპიუტერების სია ყოველ 30 წამში
});

function setupEventListeners() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const searchInput = document.getElementById('hostSearch');
    const modal = document.getElementById('hostInfoModal');
    const closeBtn = modal?.querySelector('.close');

    if (darkModeToggle) darkModeToggle.addEventListener('click', toggleDarkMode);
    if (searchInput) searchInput.addEventListener('input', searchHost);

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = "none";
        };
    }

    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
    };
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
        if (result.success) {
            showMessage(result.message);
            fetchComputers(); // განაახლეთ კომპიუტერების სია შემოწმების შემდეგ
        } else {
            showError(result.message);
        }
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
        const computerData = { ...data[hostname].static, ...data[hostname].dynamic, status: data[hostname].status };
        const computerCard = createComputerCard(hostname, computerData);
        if (computerCard) hostGrid.appendChild(computerCard);
    }
}

function createComputerCard(hostname, data) {
    const card = document.createElement('div');
    card.className = 'host-card';
    card.dataset.hostname = hostname;

    card.innerHTML = `
        <div class="card-header">
            <h3><i class="fas fa-desktop"></i> ${hostname}</h3>
            ${createDropdown(hostname)}
        </div>
        <span class="status-badge ${data.status}"><i class="fas fa-${getStatusIcon(data.status)}"></i> ${getStatusText(data.status)}</span>
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

function getStatusIcon(status) {
    switch(status) {
        case 'online': return 'check-circle';
        case 'idle': return 'clock';
        case 'offline': return 'times-circle';
        default: return 'question-circle';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'online': return 'ონლაინ';
        case 'idle': return 'უმოქმედო';
        case 'offline': return 'ოფლაინ';
        default: return 'უცნობი';
    }
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
            <div class="usage-bar"><div class="fill ${getUsageColor(data.cpu_usage)}" style="width: ${data.cpu_usage || 0}%"></div></div>
            <p><i class="fas fa-memory"></i> RAM: ${getColoredPercentage(data.memory_usage)}</p>
            <div class="usage-bar"><div class="fill ${getUsageColor(data.memory_usage)}" style="width: ${data.memory_usage || 0}%"></div></div>
            <p><i class="fas fa-hdd"></i> Disk: ${getColoredPercentage(data.disk_usage)}</p>
            <div class="usage-bar"><div class="fill ${getUsageColor(data.disk_usage)}" style="width: ${data.disk_usage || 0}%"></div></div>
            <p><i class="fas fa-network-wired"></i> Network: ${getColoredPercentage(data.network_usage)}</p>
            <div class="usage-bar"><div class="fill purple" style="width: ${data.network_usage || 0}%"></div></div>
        </div>
    `;
}

function getColoredPercentage(value) {
    if (value === undefined || value === null) return 'N/A';
    const percentage = parseFloat(value);
    const color = getUsageColor(percentage);
    return `<span class="${color}">${percentage}%</span>`;
}

function getUsageColor(value) {
    if (value === undefined || value === null) return '';
    const percentage = parseFloat(value);
    if (percentage >= 80) return 'red';
    if (percentage >= 50) return 'yellow';
    return 'green';
}

function restartHost(hostname) {
    if (confirm(`დარწმუნებული ხართ, რომ გსურთ ${hostname}-ის გადატვირთვა?`)) {
        socket.emit('restart_host', { hostname });
    }
}

function deleteHost(hostname) {
    if (confirm(`დარწმუნებული ხართ, რომ გსურთ ${hostname}-ის წაშლა?`)) {
        socket.emit('delete_host', { hostname });
    }
}

function checkHost(hostname) {
    socket.emit('check_host', { hostname });
    showMessage(`${hostname}-ის შემოწმება...`);
    // დაამატეთ ტაიმაუტი მონაცემების განახლებისთვის
    setTimeout(() => fetchComputers(), 5000);
}

function connectToAnyDesk(anydesk_id) {
    if (anydesk_id) window.open(`anydesk:${anydesk_id}`);
    else alert('AnyDesk ID არ არის ხელმისაწვდომი.');
}

function showHostInfo(hostname) {
    fetch(`/get_host_info/${hostname}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayHostInfo(hostname, data.info);
            } else {
                alert('ჰოსტის ინფორმაციის მიღება ვერ მოხერხდა');
            }
        })
        .catch(error => {
            console.error('შეცდომა ჰოსტის ინფორმაციის მიღებისას:', error);
            alert('შეცდომა ჰოსტის ინფორმაციის მიღებისას');
        });
}

function displayHostInfo(hostname, info) {
    const infoHTML = `
        <h2>${hostname}</h2>
        <p>სტატუსი: ${getStatusText(info.status)}</p>
        <p>CPU: ${getColoredPercentage(info.dynamic.cpu_usage)}</p>
        <p>RAM: ${getColoredPercentage(info.dynamic.memory_usage)}</p>
        <p>Disk: ${getColoredPercentage(info.dynamic.disk_usage)}</p>
        <p>Network: ${getColoredPercentage(info.dynamic.network_usage)}</p>
        <p>დისკის საერთო მოცულობა: ${formatBytes(info.static.disk_space_total)}</p>
        <p>RAM საერთო: ${formatBytes(info.static.memory_total)}</p>
        <p>CPU ინფორმაცია: ${info.static.cpu_info || 'N/A'}</p>
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
    const hosts = document.querySelectorAll('.host-card');
    hosts.forEach(host => {
        const hostname = host.dataset.hostname.toLowerCase();
        host.style.display = hostname.includes(searchTerm) ? '' : 'none';
    });
}

function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}