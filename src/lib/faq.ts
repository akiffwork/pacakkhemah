// src/lib/faq.ts
// FAQ content: shown on /faq and edited in Admin › Site › FAQ (settings/faq).

export type FAQItem = { question: string; question_my?: string; answer: string; answer_my?: string };
export type FAQSection = { title: string; title_my?: string; icon: string; items: FAQItem[] };

export const DEFAULT_FAQ: FAQSection[] = [
  {
    title: "General",
    title_my: "Umum",
    icon: "fa-circle-info",
    items: [
      { 
        question: "What is Pacak Khemah?", 
        question_my: "Apa itu Pacak Khemah?",
        answer: "Pacak Khemah is Malaysia's dedicated multi-vendor camping gear rental platform. We connect outdoor enthusiasts with local gear owners, making it easier to rent high-quality equipment like tents, power stations, and complete camping sets.",
        answer_my: "Pacak Khemah adalah platform sewaan peralatan perkhemahan berbilang vendor di Malaysia. Kami menghubungkan peminat aktiviti luar dengan pemilik peralatan tempatan."
      },
      { 
        question: "Is Pacak Khemah a rental shop?", 
        question_my: "Adakah Pacak Khemah sebuah kedai sewaan?",
        answer: "No. We are a technology platform that hosts multiple independent vendors. When you rent gear, you are renting directly from the shop owner listed on the page.",
        answer_my: "Tidak. Kami adalah platform teknologi yang menempatkan berbilang vendor bebas. Apabila anda menyewa, anda menyewa terus daripada pemilik kedai."
      },
    ]
  },
  {
    title: "For Customers",
    title_my: "Untuk Pelanggan",
    icon: "fa-user",
    items: [
      { 
        question: "How do I make a booking?", 
        question_my: "Bagaimana cara membuat tempahan?",
        answer: "1. Browse the gear on a vendor's storefront\n2. Select your pickup and return dates\n3. Add items to your cart\n4. Click \"Submit Order via WhatsApp\"\n5. Finalize details directly with the vendor",
        answer_my: "1. Layari peralatan di kedai vendor\n2. Pilih tarikh ambil dan pulang\n3. Tambah item ke troli\n4. Klik \"Hantar Pesanan via WhatsApp\"\n5. Selesaikan butiran dengan vendor"
      },
      { 
        question: "Why do I need to give my IC number?", 
        question_my: "Kenapa perlu beri nombor IC?",
        answer: "To ensure security of high-value equipment, vendors require identity verification. After booking confirmation, you'll receive a link to enter your IC or passport number and sign the rental agreement. No ID photo is needed.",
        answer_my: "Untuk memastikan keselamatan peralatan bernilai tinggi, vendor memerlukan pengesahan identiti. Selepas pengesahan tempahan, anda akan menerima pautan untuk mengisi nombor IC atau pasport dan menandatangani perjanjian sewa. Gambar IC tidak diperlukan."
      },
      { 
        question: "Is my data safe?", 
        question_my: "Adakah data saya selamat?",
        answer: "Yes. Your IC or passport number is kept privately with your agreement. Only your vendor can see it, and it is used only for your rental.",
        answer_my: "Ya. Nombor IC atau pasport anda disimpan secara peribadi bersama perjanjian anda. Hanya vendor anda boleh melihatnya, dan ia digunakan untuk sewaan anda sahaja."
      },
      { 
        question: "How do I pay?", 
        question_my: "Bagaimana cara bayar?",
        answer: "Payment is handled directly between you and the vendor. Most vendors accept bank transfers or E-Wallets. Details will be provided via WhatsApp.",
        answer_my: "Pembayaran diuruskan terus antara anda dan vendor. Kebanyakan vendor menerima pindahan bank atau E-Wallet."
      },
      { 
        question: "Is there a security deposit?", 
        question_my: "Ada deposit keselamatan?",
        answer: "Yes. Most vendors require a refundable deposit. The amount depends on the vendor's policy and is clearly shown in your cart summary.",
        answer_my: "Ya. Kebanyakan vendor memerlukan deposit yang boleh dikembalikan. Jumlah bergantung pada polisi vendor dan ditunjukkan dalam ringkasan troli."
      },
    ]
  },
  {
    title: "For Vendors",
    title_my: "Untuk Vendor",
    icon: "fa-store",
    items: [
      { 
        question: "How do I list my gear?", 
        question_my: "Bagaimana senaraikan peralatan?",
        answer: "Log in to your Vendor Studio and navigate to the Inventory tab. You can add items, set prices, upload photos, and manage stock levels.",
        answer_my: "Log masuk ke Vendor Studio dan pergi ke tab Inventori. Anda boleh menambah item, tetapkan harga, muat naik foto, dan urus stok."
      },
      { 
        question: "How do I verify customers?", 
        question_my: "Bagaimana sahkan pelanggan?",
        answer: "In Vendor Studio, go to the Documents tab. Copy your unique verification link and send it to customers via WhatsApp. Once they sign and upload ID, their record appears in your dashboard.",
        answer_my: "Dalam Vendor Studio, pergi ke tab Dokumen. Salin pautan pengesahan unik anda dan hantar kepada pelanggan melalui WhatsApp."
      },
      { 
        question: "How do I manage availability?", 
        question_my: "Bagaimana urus ketersediaan?",
        answer: "Use the Calendar feature to block dates when gear is rented or your shop is closed. This prevents customers from selecting unavailable dates.",
        answer_my: "Gunakan ciri Kalendar untuk menyekat tarikh apabila peralatan disewa atau kedai ditutup."
      },
      { 
        question: "What if gear is damaged?", 
        question_my: "Bagaimana jika peralatan rosak?",
        answer: "Your rental agreement includes customizable House Rules in Settings. These terms legally bind customers to your damage policies. Keep the signed PDF as record.",
        answer_my: "Perjanjian sewaan anda termasuk Peraturan Rumah yang boleh disesuaikan. Terma ini mengikat pelanggan secara sah kepada polisi kerosakan anda."
      },
    ]
  },
  {
    title: "Cancellations",
    title_my: "Pembatalan",
    icon: "fa-calendar-xmark",
    items: [
      { 
        question: "What is the cancellation policy?", 
        question_my: "Apakah polisi pembatalan?",
        answer: "Since vendors are independent, cancellation policies vary. Check the Terms of Service on the vendor's page or ask them directly via WhatsApp before payment.",
        answer_my: "Oleh kerana vendor adalah bebas, polisi pembatalan berbeza. Semak Syarat Perkhidmatan di halaman vendor atau tanya terus melalui WhatsApp."
      },
    ]
  },
];
