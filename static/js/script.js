const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const searchInput = document.getElementById('hostSearch');
    const modal = document.getElementById('hostInfoModal');
    const closeBtn = modal.querySelector('.close');

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    if (searchInput) {
        searchInput.addEventListener('input', searchHost);
    }

    closeBtn.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    fetchComputers();

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
        } else {
            showError(result.message);
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
    try {
        console.log("კომპიუტერების მიღება...");
        const response = await fetch('/get_computers');
        console.log("მიღებული პასუხი:", response);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("მიღებული მონაცემები:", data);

        if (!data || typeof data !== 'object') {
            throw new Error('მიღებული მონაცემები არასწორი ფორმატისაა');
        }

        updateComputerList(data);
    } catch (error) {
        console.error("შეცდომა კომპიუტერების მიღებისას:", error);
        showError('კომპიუტერების სიის მიღება ვერ მოხერხდა.');
    }
}

function updateComputerList(data) {
    console.log("კომპიუტერების სიის განახლება მონაცემებით:", data);
    const hostGrid = document.getElementById('hostGrid');
    hostGrid.innerHTML = '';

    if (typeof data !== 'object' || Object.keys(data).length === 0) {
        console.log("კომპიუტერები ვერ მოიძებნა ან არასწორი მონაცემებია");
        hostGrid.innerHTML = '<p>კომპიუტერები ვერ მოიძებნა.</p>';
        return;
    }

    for (const hostname in data) {
        if (data.hasOwnProperty(hostname) && hostname) {
            console.log(`დამუშავება ${hostname}:`, data[hostname]);
            const computerData = {
                ...data[hostname].static,
                ...data[hostname].dynamic
            };
            const computerCard = createComputerCard(hostname, computerData);
            if (computerCard) {
                hostGrid.appendChild(computerCard);
            } else {
                console.log(`ვერ შეიქმნა ბარათი ${hostname}-სთვის`);
            }
        }
    }
}

function createComputerCard(hostname, data) {
    console.log("ბარათის შექმნა:", hostname, data);
    if (!hostname) {
        console.error("მცდელობა ცარიელი hostname-ისთვის ბარათის შექმნის");
        return null;
    }

    const card = document.createElement('div');
    card.className = 'host-card';
    card.dataset.hostname = hostname;
    const status = determineStatus(data);
    card.innerHTML = `
        <div class="card-header">
            <h3><i class="fas fa-desktop"></i> ${hostname}</h3>
            <div class="dropdown">
                <button class="dropbtn"><i class="fas fa-ellipsis-v"></i></button>
                <div class="dropdown-content">
                    <a href="#" onclick="restartHost('${hostname}')"><i class="fas fa-redo"></i> გადატვირთვა</a>
                    <a href="#" onclick="deleteHost('${hostname}')"><i class="fas fa-trash"></i> წაშლა</a>
                    <a href="#" onclick="showHostInfo('${hostname}')"><i class="fas fa-info-circle"></i> ინფორმაცია</a>
                </div>
            </div>
        </div>
        <span class="status-badge ${status}"><i class="fas fa-${status === 'online' ? 'check-circle' : 'times-circle'}"></i> ${status === 'online' ? 'ონლაინ' : 'ოფლაინ'}</span>
        <div class="usage-info">
            <p><i class="fas fa-microchip"></i> CPU: ${data.cpu_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.cpu_usage || 0}%"></div></div>
            <p><i class="fas fa-memory"></i> RAM: ${data.memory_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.memory_usage || 0}%"></div></div>
            <p><i class="fas fa-hdd"></i> დისკი: ${data.disk_usage || 'N/A'}%</p>
            <div class="usage-bar"><div class="fill" style="width: ${data.disk_usage || 0}%"></div></div>
        </div>
        <p><i class="fas fa-network-wired"></i> IP: ${data.ip_address || 'N/A'}</p>
        <p><i class="fas fa-id-badge"></i> AnyDesk ID: ${data.anydesk_id || 'N/A'}</p>
        <div class="card-buttons">
            <button class="check-btn" onclick="checkHost('${hostname}')"><i class="fas fa-sync"></i> შემოწმება</button>
            <button class="anydesk-btn" onclick="connectToAnyDesk('${data.anydesk_id || ''}')"><i class="fas fa-desktop"></i> AnyDesk</button>
        </div>
    `;
    card.dataset.lastUpdate = data.last_update || '';
    console.log("შექმნილი ბარათი:", card);
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
    if (confirm(`დარწმუნებული ხართ, რომ გსურთ გადატვირთოთ ${hostname}?`)) {
        console.log(`გადაიტვირთება ჰოსტი: ${hostname}`);
        socket.emit('restart_host', { hostname });
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
    showMessage(`მიმდინარეობს ${hostname}-ის შემოწმება...`);
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

function showMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.textContent = message;
    document.body.appendChild(messageElement);
    setTimeout(() => {
        document.body.removeChild(messageElement);
    }, 3000);
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
    if (confirm(`დარწმუნებული ხართ, რომ გსურთ წაშალოთ ${hostname}?`)) {
        console.log(`იშლება ჰოსტი: ${hostname}`);
        socket.emit('delete_host', { hostname });
    }
}

function showHostInfo(hostname) {
    console.log(`ინფორმაციის ჩვენება ჰოსტისთვის: ${hostname}`);
    fetch(`/get_host_info/${hostname}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const infoHTML = `
                    <h2>${hostname}</h2>
                    <p>CPU: ${data.info.dynamic.cpu_usage}%</p>
                    <p>RAM: ${data.info.dynamic.memory_usage}%</p>
                    <p>დისკი: ${data.info.dynamic.disk_usage}%</p>
                    <p>IP მისამართი: ${data.info.static.ip_address}</p>
                    <p>AnyDesk ID: ${data.info.static.anydesk_id}</p>
                    <p>ბოლო განახლება: ${new Date(data.info.dynamic.last_update).toLocaleString()}</p>
                `;
                document.getElementById('hostInfoContent').innerHTML = infoHTML;
                document.getElementById('hostInfoModal').style.display = "block";
            } else {
                alert('ვერ მოხერხდა ჰოსტის ინფორმაციის მიღება');
            }
        })
        .catch(error => {
            console.error('შეცდომა ჰოსტის ინფორმაციის მიღებისას:', error);
            alert('შეცდომა ჰოსტის ინფორმაციის მიღებისას');
        });
}

if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    updateDarkModeButton();
}

setInterval(fetchComputers, 30000);