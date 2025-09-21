document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const addReportBtn = document.getElementById('addReportBtn');
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    const reportModal = document.getElementById('reportModal');
    const reportForm = document.getElementById('reportForm');
    const cancelBtn = document.getElementById('cancelBtn');
    const reportContainer = document.getElementById('report-container');
    const clientNameInput = document.getElementById('clientName');
    const clientAddressInput = document.getElementById('clientAddress');
    const clientUnitInput = document.getElementById('clientUnit');
    const serviceDateInput = document.getElementById('serviceDate');
    const itemServiceSelect = document.getElementById('itemService');
    const customServiceGroup = document.getElementById('customServiceGroup');
    const itemCustomServiceInput = document.getElementById('itemCustomService');
    const itemDescriptionInput = document.getElementById('itemDescription');
    const itemPriceInput = document.getElementById('itemPrice');
    const addItemBtn = document.getElementById('addItemBtn');
    const itemsPreviewTableBody = document.querySelector('#items-preview-table tbody');
    const clientNamesList = document.getElementById('clientNamesList');

    let reportItems = [];
    let clients = [];
    const logoUrl = 'bay-services-logo.png';

    // --- Local Storage Functions ---
    function loadClientsFromStorage() {
        const storedClients = localStorage.getItem('serviceReportClients');
        if (storedClients) {
            clients = JSON.parse(storedClients);
            populateClientDatalist();
        }
    }
    function saveClientsToStorage() {
        localStorage.setItem('serviceReportClients', JSON.stringify(clients));
    }
    function populateClientDatalist() {
        clientNamesList.innerHTML = '';
        const uniqueNames = [...new Set(clients.map(c => c.name))];
        uniqueNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            clientNamesList.appendChild(option);
        });
    }
    function updateClientData(newClient) {
        const existingClientIndex = clients.findIndex(c => c.name.toLowerCase() === newClient.name.toLowerCase());
        if (existingClientIndex > -1) {
            clients[existingClientIndex] = { ...clients[existingClientIndex], ...newClient };
        } else {
            clients.push(newClient);
        }
        saveClientsToStorage();
        populateClientDatalist();
    }

    // --- Event Listeners ---
    loadClientsFromStorage();
    
    clientNameInput.addEventListener('input', (e) => {
        const client = clients.find(c => c.name === e.target.value);
        if (client) {
            clientAddressInput.value = client.address;
            clientUnitInput.value = client.unit;
        }
    });

    addReportBtn.addEventListener('click', () => {
        resetForm();
        reportModal.classList.remove('hidden');
        reportContainer.classList.add('hidden');
        exportPdfBtn.classList.add('hidden');
    });

    cancelBtn.addEventListener('click', () => {
        reportModal.classList.add('hidden');
    });

    itemServiceSelect.addEventListener('change', () => {
        customServiceGroup.classList.toggle('hidden', itemServiceSelect.value !== 'Other');
    });

    addItemBtn.addEventListener('click', () => {
        let service = itemServiceSelect.value === 'Other' ? itemCustomServiceInput.value.trim() : itemServiceSelect.value;
        const price = parseFloat(itemPriceInput.value);
        if (service && !isNaN(price) && price >= 0) {
            reportItems.push({ service, description: itemDescriptionInput.value.trim(), price });
            renderItemsPreview();
            itemServiceSelect.value = '';
            itemCustomServiceInput.value = '';
            customServiceGroup.classList.add('hidden');
            itemDescriptionInput.value = '';
            itemPriceInput.value = '';
        } else {
            alert('Please select a service and enter a valid price.');
        }
    });
    
    itemsPreviewTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-item-btn')) {
            reportItems.splice(parseInt(e.target.dataset.index, 10), 1);
            renderItemsPreview();
        }
    });

    reportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!reportForm.checkValidity()) {
            alert('Please fill out all required fields (Client Name, Address, and Service Date).');
            return;
        }
        updateClientData({ name: clientNameInput.value.trim(), address: clientAddressInput.value.trim(), unit: clientUnitInput.value.trim() });
        generateReportPreview();
        reportModal.classList.add('hidden');
        reportContainer.classList.remove('hidden');
        exportPdfBtn.classList.remove('hidden');
    });

    exportPdfBtn.addEventListener('click', async () => {
        const element = document.getElementById('report-container');
        
        // =================================================================
        // >>>>>>>>>> ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ <<<<<<<<<<<
        // Получаем актуальный адрес из поля предпросмотра ПЕРЕД клонированием
        // =================================================================
        const previewClientInfoText = document.getElementById('previewClientInfo').value;
        const textLines = previewClientInfoText.split('\n');
        // Вторая строка (индекс 1) - это адрес
        const addressLine = textLines.length > 1 ? textLines[1].trim() : ''; 
        const houseNumber = addressLine ? addressLine.split(' ')[0] : '';

        const elementClone = element.cloneNode(true);
        const logoInClone = elementClone.querySelector('#reportLogo');

        try {
            const response = await fetch(logoUrl);
            const blob = await response.blob();
            const dataUrl = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            logoInClone.src = dataUrl;
        } catch (error) {
            console.error("Could not process logo:", error);
            alert("Error: Could not load the logo for the PDF. Please check your internet connection.");
            return;
        }

        let reportCounter = (parseInt(localStorage.getItem('reportCounter') || '1000')) + 1;
        localStorage.setItem('reportCounter', reportCounter.toString());
        const reportNumString = `R-${reportCounter}`;

        const reportNumElement = elementClone.querySelector('#reportNumPlaceholder');
        if (reportNumElement) reportNumElement.textContent = reportNumString;
        
        elementClone.querySelectorAll('.editable-field').forEach(field => {
            const textNode = document.createElement('div');
            textNode.innerText = field.value || field.textContent;
            if (field.tagName === 'TEXTAREA') textNode.style.whiteSpace = 'pre-wrap';
            if (field.classList.contains('align-right')) textNode.style.textAlign = 'right';
            field.parentNode.replaceChild(textNode, field);
        });
        
        let fileName = `Service Report - ${reportNumString}`;
        if (houseNumber) {
            fileName += ` - ${houseNumber}`;
        }
        fileName += '.pdf';
        
        const options = { margin: 0, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
        
        html2pdf().from(elementClone).set(options).save();
    });

    // --- Functions ---
    function renderItemsPreview() {
        itemsPreviewTableBody.innerHTML = '';
        reportItems.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${escapeHTML(item.service)}</td><td>${escapeHTML(item.description)}</td><td>$${item.price.toFixed(2)}</td><td><button type="button" class="btn-danger delete-item-btn" data-index="${index}">X</button></td>`;
            itemsPreviewTableBody.appendChild(row);
        });
    }

    function generateReportPreview() {
        const clientName = clientNameInput.value;
        const serviceDate = new Date(serviceDateInput.value).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        let fullAddress = escapeHTML(clientAddressInput.value);
        if (clientUnitInput.value) fullAddress += `\nUnit: ${escapeHTML(clientUnitInput.value)}`;
        let total = reportItems.reduce((sum, item) => sum + item.price, 0);
        let itemsHtml = reportItems.length ? reportItems.map(item => `
            <tr>
                <td><strong>${escapeHTML(item.service)}</strong></td>
                <td class="item-sub-description">${escapeHTML(item.description)}</td>
                <td style="text-align: right;">$${item.price.toFixed(2)}</td>
            </tr>`).join('') : `<tr><td colspan="3">No services added.</td></tr>`;
        
        reportContainer.innerHTML = `
            <header>
                <img id="reportLogo" src="${logoUrl}" alt="Bay Services Logo">
            </header>
            <main>
                <h1>Service Report</h1>
                <div class="report-meta">
                    <div class="client-info-block">
                        <strong>Bill To:</strong>
                        <div style="margin-top: 8px;"><textarea class="editable-field" id="previewClientInfo">${escapeHTML(clientName)}\n${fullAddress}</textarea></div>
                    </div>
                    <div class="report-details-block">
                        <div><strong>Service Date:</strong> <input type="text" class="editable-field align-right" value="${serviceDate}"></div>
                        <div><strong>Report #:</strong> <span id="reportNumPlaceholder">TBD</span></div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 30%;">Service</th>
                            <th>Description</th>
                            <th style="width: 20%; text-align: right;">Price</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div class="total-section">
                   <div class="total-box"><strong>Total: $${total.toFixed(2)}</strong></div>
                </div>
            </main>
            <footer>
                <p>3700 Lick Mill Blvd, Apt. 311, Santa Clara, CA, 95054</p>
                <p>Phone: (650) 731-7359 | Email: info@thebayservices.com | Web: www.thebayservices.com</p>
            </footer>`;
    }

    function resetForm() {
        reportForm.reset();
        reportItems = [];
        renderItemsPreview();
        serviceDateInput.valueAsDate = new Date();
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    resetForm();
});
