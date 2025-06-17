# <img src="https://cdn-icons-png.flaticon.com/512/5647/5647568.png" alt="Convert Icon" width="24" style="vertical-align: middle;"/> UniConvert

Welcome to **UniConvert**, your seamless solution for universal file conversion!
A modern web app built with **React**, **Node.js**, **Express**, and the power of **CloudConvert API**.

---

## 🌟 Features

- 📄 **Universal File Conversion**: Convert between a wide array of document, image, audio, and video formats.
- 🚀 **Intuitive & Fast**: Simple drag-and-drop or file selection for quick conversions.
- ☁️ **Cloud-Powered**: Leverages the robust [CloudConvert API](https://cloudconvert.com/api/v2) for reliable conversions.
- 🌐 **Web-Based**: No software installation required—convert files directly from your browser.
- ⚙️ **Optimized Performance**: Efficient handling of file uploads and downloads.
- ⚛️ **React Frontend** with a clean and responsive interface.

---

## 🕹️ How It Works

1.  **Select a File** → Choose any document, image, audio, or video file from your device.
2.  **Choose Output Format** → Select your desired target format (e.g., PDF, DOCX, JPG, MP4).
3.  **Convert** → Click the button and let UniConvert process your file in the cloud.
4.  **Download** → Your converted file will automatically download to your device!

---

## 🧠 Tech Stack

| Layer         | Tech                               |
|---------------|------------------------------------|
| Frontend      | React (Vite)                       |
| Backend       | Node.js, Express                   |
| File Handling | Multer, FormData                   |
| API Client    | Axios                              |
| Conversion API| CloudConvert API                   |
| Hosting       | Vercel (Frontend, Backend)         |

---

## ⚙️ Requirements

- **Node.js** v18 or higher
- **npm** or **yarn**
- **CloudConvert API Key**

---

## 🛠️ Setup Instructions

To get UniConvert up and running on your local machine, follow these steps:

### 📥 Clone the repo

```bash
git clone https://github.com/Manmayarama/UniConvert.git
cd UniConvert
```

## 📦 Install Dependencies

Navigate into the `Frontend` and `Backend` directories to install their respective dependencies:

```bash
# For Frontend
cd Frontend && npm install

# For Backend
cd Backend && npm install
```

## 🔐 .env Configuration

Create a `.env` file in the root of your **`Backend` directory** (`UniConvert/Backend/.env`) and add your CloudConvert API key:

```env
CLOUDCONVERT_API_KEY="your_cloudconvert_api_key_here"
```

## 🚀 Running the Application

### 🗄️ Start the Backend

From the `Backend` directory:

```bash
npm start
```

### 📱 Start the Frontend

From the `Frontend` directory:

```bash
npm run dev
```

## 📥 Try It

Try the live version:
🔗  https://uni-convert-seven.vercel.app/
