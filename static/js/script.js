const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    const addButton = document.getElementById('add-button');
    const hostnameInput = document.getElementById('hostname-input');

    addButton.addEventListener('click', addHostname);
    hostnameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addHostname();
        }
    });

    fetchComputers();
});

function addHostname() {
    const hostnameInput = document.getElementById('hostname-input');
    const hostname = hostnameInput.value.trim();
    if (hostname) {
        socket.emit('add_hostname', { hostname });
        hostnameInput.value = '';
    } else {
        showError('გთხოვთ, შეიყვანოთ ჰოსტის სახელი.');
    }
}

function fetchComputers() {
    fetch('/get_computers')
        .then(response => response.json())
        .then(data => updateComputerList(data))
        .catch(error => showError('კომპიუტერების სიის მიღება ვერ მოხერხდა.'));
}

function updateComputerList(data) {
    const computerList = document.getElementById('computer-list');
    computerList.innerHTML = '';

    for (const hostname in data) {
        const computerDiv = createComputerElement(hostname, data[hostname]);
        computerList.appendChild(computerDiv);
    }
}

function createComputerElement(hostname, data) {
    const computerDiv = document.createElement('div');
    computerDiv.className = 'computer fade-in';
    computerDiv.innerHTML = `
        <h3>${hostname} - სტატუსი: ${data.status}</h3>
        <div class="computer-buttons">
            <button class="edit-button" onclick="editHostname('${hostname}')">რედაქტირება</button>
            <button class="delete-button" onclick="deleteHostname('${hostname}')">წაშლა</button>
            <button class="info-button" onclick="requestComputerData('${hostname}')">ინფორმაცია</button>
        </div>
    `;
    return computerDiv;
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

function requestComputerData(hostname) {
    socket.emit('request_data', { hostname });
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