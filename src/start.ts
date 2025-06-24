console.log('main.ts loaded');

const addressInput = document.getElementById('addressInput') as HTMLInputElement;
const addAddressBtn = document.getElementById('addAddressBtn') as HTMLButtonElement;
const addressList = document.getElementById('addressList') as HTMLUListElement;
const goToToolBtn = document.getElementById('goToToolBtn') as HTMLButtonElement;

let savedAddresses: string[] = JSON.parse(localStorage.getItem('savedTreasuryAddresses') || '[]');

function saveAddresses() {
  localStorage.setItem('savedTreasuryAddresses', JSON.stringify(savedAddresses));
}

function renderAddresses() {
  addressList.innerHTML = '';

  if (savedAddresses.length === 0) {
    addressList.innerHTML = '<li>No saved addresses found.</li>';
    return;
  }

  savedAddresses.forEach(address => {
    const li = document.createElement('li');

    const btn = document.createElement('button');
    btn.textContent = address;
    btn.className = 'address-button';
    btn.type = 'button';

    // Pass the address as a query parameter to start.html
    btn.addEventListener('click', () => {
      window.location.href = `/bocdecoder/start.html?address=${encodeURIComponent(address)}`;
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.style.color = 'red';
    deleteBtn.addEventListener('click', () => {
      savedAddresses = savedAddresses.filter(a => a !== address);
      saveAddresses();
      renderAddresses();
    });

    li.appendChild(btn);
    li.appendChild(deleteBtn);
    addressList.appendChild(li);
  });
}

// Initial render
renderAddresses();

// Add new address
addAddressBtn.addEventListener('click', () => {
  const newAddress = addressInput.value.trim();
  if (newAddress && !savedAddresses.includes(newAddress)) {
    savedAddresses.push(newAddress);
    saveAddresses();
    renderAddresses();
    addressInput.value = '';
  }
});

// Go to tool button (without specific address)
goToToolBtn.addEventListener('click', () => {
  window.location.href = '/bocdecoder/start.html';
});
