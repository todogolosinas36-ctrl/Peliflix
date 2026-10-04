document.addEventListener('DOMContentLoaded', () => {
  const apiInput = document.getElementById('tmdb-api-input');
  const saveBtn = document.getElementById('save-api-btn');
  const toast = document.getElementById('toast-notification');
  const toastMessage = document.getElementById('toast-message');
  let toastTimeout;

  // Restaurar el valor guardado
  const savedKey = localStorage.getItem('tmdb_api_key') || localStorage.getItem('peloflix_tmdb_api_key');
  if (savedKey) {
    apiInput.value = savedKey;
  }

  // Guardar al hacer click
  saveBtn.addEventListener('click', () => {
    saveApiKey();
  });

  // Guardar con Enter
  apiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveApiKey();
    }
  });

  function saveApiKey() {
    const key = apiInput.value.trim();
    if (key) {
      localStorage.setItem('tmdb_api_key', key);
      // Mantener compatibilidad con la app principal si usa 'peloflix_tmdb_api_key'
      localStorage.setItem('peloflix_tmdb_api_key', key); 
      showToast('API Key guardada con éxito');
    } else {
      showToast('Por favor, ingresa una API Key válida', true);
    }
  }

  function showToast(message, isError = false) {
    toastMessage.textContent = message;
    
    if (isError) {
      toast.style.backgroundColor = '#E50914';
      toast.querySelector('i').className = 'fa-solid fa-circle-exclamation';
    } else {
      toast.style.backgroundColor = 'rgba(20, 164, 77, 0.9)';
      toast.querySelector('i').className = 'fa-solid fa-circle-check';
    }

    toast.classList.remove('hidden');
    toast.classList.add('show');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.classList.add('hidden');
      }, 300); // Espera a que termine la transición css
    }, 3000);
  }
});
