// Connection status handling
export function setConnectionState(state) {
    const connStatus = document.getElementById('connStatus');
    const statusText = document.getElementById('statusText');
    if (!connStatus || !statusText) return;
    connStatus.classList.remove('online', 'busy', 'offline');
    if (state === 'online')  { connStatus.classList.add('online');  statusText.textContent = 'online'; }
    if (state === 'busy')    { connStatus.classList.add('busy');    statusText.textContent = 'busy'; }
    if (state === 'offline') { connStatus.classList.add('offline'); statusText.textContent = 'offline'; }
}
