const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransporter({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_SECURE === 'true', // true untuk port 465, false untuk port lainnya
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            // Konfigurasi tambahan untuk berbagai provider
            tls: {
                rejectUnauthorized: false // untuk self-signed certificates
            },
            debug: process.env.NODE_ENV === 'development',
            logger: process.env.NODE_ENV === 'development'
        });

        // Verify connection configuration
        this.verifyConnection();
    }

    async verifyConnection() {
        try {
            await this.transporter.verify();
            console.log('✅ SMTP server siap untuk mengirim email');
        } catch (error) {
            console.error('❌ SMTP server tidak dapat terhubung:', error.message);
        }
    }

    async sendRegistrationConfirmation(visitorData) {
        try {
            const { 
                email, 
                nama_lengkap, 
                registration_code, 
                category, 
                qr_code_url 
            } = visitorData;

            // Path ke QR code file
            const qrCodePath = path.join(__dirname, '../../../public', qr_code_url);

            // Template email HTML
            const htmlContent = this.generateEmailTemplate(visitorData);

            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: `Konfirmasi Registrasi - ${process.env.APP_NAME}`,
                html: htmlContent,
                attachments: [
                    {
                        filename: `QR-Code-${registration_code}.png`,
                        path: qrCodePath,
                        cid: 'qrcode' // Content-ID untuk embed di email
                    }
                ]
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Email berhasil dikirim ke ${email}:`, result.messageId);
            
            return {
                success: true,
                messageId: result.messageId
            };

        } catch (error) {
            console.error('❌ Gagal mengirim email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    generateEmailTemplate(visitorData) {
        const { 
            nama_lengkap, 
            registration_code, 
            category, 
            email,
            event_name = 'Tech Conference 2024',
            event_date = '15 Agustus 2024',
            event_location = 'Jakarta Convention Center'
        } = visitorData;

        return `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Konfirmasi Registrasi</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .qr-section { text-align: center; margin: 30px 0; padding: 20px; background: white; border-radius: 10px; border: 2px dashed #007bff; }
                .info-box { background: #e3f2fd; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .category-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; color: white; }
                .vip { background: #FFD700; color: #000; }
                .sponsor { background: #FF6B35; }
                .speaker { background: #4ECDC4; }
                .participant { background: #45B7D1; }
                .footer { text-align: center; margin-top: 30px; padding: 20px; border-top: 1px solid #ddd; color: #666; }
                .button { display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Registrasi Berhasil!</h1>
                    <p>Selamat datang di ${event_name}</p>
                </div>
                
                <div class="content">
                    <h2>Halo, ${nama_lengkap}!</h2>
                    <p>Terima kasih telah mendaftar untuk mengikuti <strong>${event_name}</strong>. Registrasi Anda telah berhasil diproses.</p>
                    
                    <div class="info-box">
                        <h3>📋 Detail Registrasi:</h3>
                        <ul>
                            <li><strong>Kode Registrasi:</strong> <code>${registration_code}</code></li>
                            <li><strong>Nama:</strong> ${nama_lengkap}</li>
                            <li><strong>Email:</strong> ${email}</li>
                            <li><strong>Kategori:</strong> <span class="category-badge ${category.toLowerCase()}">${category}</span></li>
                        </ul>
                    </div>

                    <div class="info-box">
                        <h3>📅 Detail Acara:</h3>
                        <ul>
                            <li><strong>Acara:</strong> ${event_name}</li>
                            <li><strong>Tanggal:</strong> ${event_date}</li>
                            <li><strong>Lokasi:</strong> ${event_location}</li>
                            <li><strong>Waktu:</strong> 08:00 - 18:00 WIB</li>
                        </ul>
                    </div>

                    <div class="qr-section">
                        <h3>🎫 QR Code Anda</h3>
                        <p>Tunjukkan QR Code ini saat check-in di acara:</p>
                        <img src="cid:qrcode" alt="QR Code" style="max-width: 300px; height: auto;">
                        <p><small>QR Code juga tersedia sebagai attachment email ini</small></p>
                    </div>

                    <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border-left: 5px solid #ffc107;">
                        <h3>⚠️ Penting untuk Diingat:</h3>
                        <ul>
                            <li>Simpan QR Code ini dengan baik</li>
                            <li>Datang 30 menit sebelum acara dimulai</li>
                            <li>Bawa identitas resmi (KTP/SIM/Passport)</li>
                            <li>QR Code bersifat personal dan tidak dapat dipindahtangankan</li>
                        </ul>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL}" class="button">Kunjungi Website Acara</a>
                    </div>
                </div>

                <div class="footer">
                    <p>Jika ada pertanyaan, silakan hubungi kami:</p>
                    <p>📧 ${process.env.EMAIL_FROM} | 📱 +62-xxx-xxxx-xxxx</p>
                    <p><small>&copy; 2024 ${event_name}. All rights reserved.</small></p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Method untuk mengirim email notifikasi admin
    async sendAdminNotification(visitorData) {
        try {
            const { nama_lengkap, email, registration_code, category } = visitorData;

            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: process.env.EMAIL_USER, // atau email admin terpisah
                subject: `Registrasi Baru - ${registration_code}`,
                html: `
                    <h3>Registrasi Peserta Baru</h3>
                    <p><strong>Nama:</strong> ${nama_lengkap}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Kode:</strong> ${registration_code}</p>
                    <p><strong>Kategori:</strong> ${category}</p>
                    <p><strong>Waktu:</strong> ${new Date().toLocaleString('id-ID')}</p>
                `
            };

            await this.transporter.sendMail(mailOptions);
            console.log(`📧 Notifikasi admin dikirim untuk registrasi ${registration_code}`);

        } catch (error) {
            console.error('❌ Gagal mengirim notifikasi admin:', error);
        }
    }
}

module.exports = new EmailService();
