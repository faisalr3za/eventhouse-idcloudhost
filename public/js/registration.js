// Registration Form JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Variables
    let selectedCategoryId = null;
    let selectedCategoryCode = null;
    let selectedCategoryName = null;
    
    const progressBar = document.getElementById('progressBar');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const nextStep1Btn = document.getElementById('nextStep1');
    const prevStep2Btn = document.getElementById('prevStep2');
    const categoryCards = document.querySelectorAll('.category-card');
    const registrationForm = document.getElementById('registrationForm');
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    
    // Step 1: Category Selection
    categoryCards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove selected class from all cards
            categoryCards.forEach(c => c.classList.remove('selected'));
            
            // Add selected class to clicked card
            this.classList.add('selected');
            
            // Get category data
            selectedCategoryId = this.dataset.category;
            selectedCategoryCode = this.dataset.code;
            selectedCategoryName = this.querySelector('.card-title').textContent;
            
            // Enable next button
            nextStep1Btn.disabled = false;
        });
    });
    
    // Next Step 1
    nextStep1Btn.addEventListener('click', function() {
        if (selectedCategoryId) {
            // Update progress bar
            progressBar.style.width = '75%';
            
            // Hide step 1, show step 2
            step1.classList.add('d-none');
            step2.classList.remove('d-none');
            
            // Set selected category in hidden input
            document.getElementById('selectedCategory').value = selectedCategoryId;
            
            // Display selected category
            displaySelectedCategory();
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    // Previous Step 2
    prevStep2Btn.addEventListener('click', function() {
        // Update progress bar
        progressBar.style.width = '50%';
        
        // Hide step 2, show step 1
        step2.classList.add('d-none');
        step1.classList.remove('d-none');
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Display selected category
    function displaySelectedCategory() {
        const display = document.getElementById('selectedCategoryDisplay');
        const categoryColors = {
            'VIP': '#FFD700',
            'SPR': '#FF6B35',
            'SPK': '#4ECDC4',
            'PTC': '#45B7D1'
        };
        
        const categoryIcons = {
            'VIP': 'bi-crown-fill',
            'SPR': 'bi-handshake-fill',
            'SPK': 'bi-mic-fill',
            'PTC': 'bi-people-fill'
        };
        
        display.innerHTML = `
            <i class="${categoryIcons[selectedCategoryCode]}" style="color: ${categoryColors[selectedCategoryCode]}"></i>
            <strong>Kategori yang dipilih: ${selectedCategoryName}</strong>
            <small class="d-block mt-1">Kode registrasi akan dimulai dengan: ${selectedCategoryCode}001, ${selectedCategoryCode}002, dst.</small>
        `;
    }
    
    // Form validation
    registrationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (this.checkValidity()) {
            submitRegistration();
        } else {
            this.classList.add('was-validated');
        }
    });
    
    // Real-time validation
    const requiredFields = registrationForm.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', function() {
            if (this.checkValidity()) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            } else {
                this.classList.remove('is-valid');
                this.classList.add('is-invalid');
            }
        });
        
        field.addEventListener('input', function() {
            if (this.classList.contains('is-invalid') && this.checkValidity()) {
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            }
        });
    });
    
    // Phone number formatting
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', function() {
            // Remove non-numeric characters except +
            this.value = this.value.replace(/[^\d+]/g, '');
            
            // Auto-add country code for Indonesian numbers
            if (this.value.startsWith('08')) {
                this.value = '+62' + this.value.substring(1);
            }
        });
    });
    
    // Submit registration
    async function submitRegistration() {
        try {
            // Show loading modal
            loadingModal.show();
            
            // Get form data
            const formData = new FormData(registrationForm);
            const data = Object.fromEntries(formData.entries());
            
            // Send to API
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            // Hide loading modal
            loadingModal.hide();
            
            if (response.ok) {
                // Success
                showSuccessPage(result);
            } else {
                // Error
                showAlert('danger', result.message || 'Terjadi kesalahan saat registrasi');
            }
            
        } catch (error) {
            // Hide loading modal
            loadingModal.hide();
            
            console.error('Registration error:', error);
            showAlert('danger', 'Terjadi kesalahan koneksi. Silakan coba lagi.');
        }
    }
    
    // Show success page
    function showSuccessPage(data) {
        // Update progress bar to 100%
        progressBar.style.width = '100%';
        
        // Hide form steps
        step1.classList.add('d-none');
        step2.classList.add('d-none');
        
        // Create success content
        const successContent = `
            <div class="card shadow-sm border-success">
                <div class="card-header bg-success text-white text-center">
                    <h4 class="mb-0">
                        <i class="bi bi-check-circle-fill"></i> Registrasi Berhasil!
                    </h4>
                </div>
                <div class="card-body text-center">
                    <div class="mb-4">
                        <i class="bi bi-person-check-fill text-success" style="font-size: 4rem;"></i>
                    </div>
                    
                    <h5 class="text-success mb-3">Selamat, ${data.nama_lengkap}!</h5>
                    <p class="lead">Registrasi Anda telah berhasil diproses.</p>
                    
                    <div class="alert alert-info">
                        <h6><i class="bi bi-info-circle"></i> Detail Registrasi:</h6>
                        <ul class="list-unstyled mb-0">
                            <li><strong>Kode Registrasi:</strong> <code>${data.registration_code}</code></li>
                            <li><strong>Kategori:</strong> ${selectedCategoryName}</li>
                            <li><strong>Email:</strong> ${data.email}</li>
                            <li><strong>Acara:</strong> Tech Conference 2024</li>
                        </ul>
                    </div>
                    
                    <div class="row g-3 mt-3">
                        <div class="col-md-6">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <i class="bi bi-envelope-fill text-primary" style="font-size: 2rem;"></i>
                                    <h6 class="mt-2">Email Konfirmasi</h6>
                                    <p class="small mb-0">QR Code dan detail acara telah dikirim ke email Anda</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card bg-light">
                                <div class="card-body">
                                    <i class="bi bi-qr-code text-success" style="font-size: 2rem;"></i>
                                    <h6 class="mt-2">QR Code</h6>
                                    <p class="small mb-0">Tunjukkan QR Code saat check-in di acara</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="alert alert-warning mt-4">
                        <h6><i class="bi bi-exclamation-triangle"></i> Penting!</h6>
                        <ul class="text-start mb-0">
                            <li>Simpan QR Code dengan baik</li>
                            <li>Datang 30 menit sebelum acara dimulai</li>
                            <li>Bawa identitas resmi (KTP/SIM/Passport)</li>
                            <li>QR Code bersifat personal dan tidak dapat dipindahtangankan</li>
                        </ul>
                    </div>
                    
                    <div class="mt-4">
                        <a href="index.html" class="btn btn-primary me-2">
                            <i class="bi bi-house"></i> Kembali ke Beranda
                        </a>
                        <button type="button" class="btn btn-outline-success" onclick="window.print()">
                            <i class="bi bi-printer"></i> Cetak Konfirmasi
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Replace form content with success message
        document.querySelector('.form-section .container .row .col-lg-8').innerHTML = successContent;
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Send confirmation email notification
        setTimeout(() => {
            showAlert('info', `Email konfirmasi telah dikirim ke ${data.email}. Silakan cek inbox atau folder spam Anda.`);
        }, 2000);
    }
    
    // Show alert message
    function showAlert(type, message) {
        const alertContainer = document.getElementById('alertContainer');
        const alertId = 'alert-' + Date.now();
        
        const alertHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert" id="${alertId}">
                <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'}"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        alertContainer.innerHTML = alertHTML;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
        
        // Scroll to alert
        alertContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Email validation enhancement
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('blur', function() {
        if (this.value && !isValidEmail(this.value)) {
            this.setCustomValidity('Format email tidak valid');
        } else {
            this.setCustomValidity('');
        }
    });
    
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Phone validation enhancement
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('blur', function() {
        if (this.value && !isValidPhone(this.value)) {
            this.setCustomValidity('Format nomor telepon tidak valid');
        } else {
            this.setCustomValidity('');
        }
    });
    
    function isValidPhone(phone) {
        // Indonesian phone number validation
        const phoneRegex = /^(\+62|62|0)[0-9]{9,13}$/;
        return phoneRegex.test(phone.replace(/[\s-]/g, ''));
    }
    
    // Form auto-save to localStorage (optional)
    const formFields = registrationForm.querySelectorAll('input, textarea, select');
    formFields.forEach(field => {
        // Load saved data
        const savedValue = localStorage.getItem('registration_' + field.name);
        if (savedValue && field.type !== 'checkbox') {
            field.value = savedValue;
        } else if (savedValue && field.type === 'checkbox') {
            field.checked = savedValue === 'true';
        }
        
        // Save data on change
        field.addEventListener('change', function() {
            if (this.type === 'checkbox') {
                localStorage.setItem('registration_' + this.name, this.checked);
            } else {
                localStorage.setItem('registration_' + this.name, this.value);
            }
        });
    });
    
    // Clear saved data on successful registration
    function clearSavedData() {
        formFields.forEach(field => {
            localStorage.removeItem('registration_' + field.name);
        });
    }
    
    // Handle network connectivity
    window.addEventListener('online', function() {
        showAlert('success', 'Koneksi internet tersambung kembali.');
    });
    
    window.addEventListener('offline', function() {
        showAlert('warning', 'Koneksi internet terputus. Data form akan tersimpan otomatis.');
    });
});
