import React, { useState } from "react";
import axios from "axios";

function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [convert, setConvert] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [outputFormat, setOutputFormat] = useState("pdf");
  const [isLoading, setIsLoading] = useState(false);

  const commonOutputFormats = [
    { value: "pdf", label: "PDF" },
    { value: "docx", label: "DOCX (Word)" },
    { value: "xlsx", label: "XLSX (Excel)" },
    { value: "pptx", label: "PPTX (PowerPoint)" },
    { value: "jpg", label: "JPG (Image)" },
    { value: "png", label: "PNG (Image)" },
    { value: "webp", label: "WebP (Image)" },
    { value: "mp4", label: "MP4 (Video)" }, 
    { value: "mp3", label: "MP3 (Audio)" }, 
    { value: "txt", label: "TXT (Text)" },
    { value: "html", label: "HTML" },
  ];

  const BASE_BACKEND_URL =
    process.env.NODE_ENV === "production"
      ? "https://uni-convert-drab.vercel.app" 
      : "http://localhost:3000";

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setConvert("");
    setDownloadError("");
  };

  const handleOutputFormatChange = (e) => {
    setOutputFormat(e.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setConvert("Please select a file.");
      return;
    }

    setIsLoading(true);
    setConvert("Converting file, please wait...");
    setDownloadError("");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("outputFormat", outputFormat);

    try {
      const conversionUrl = `${BASE_BACKEND_URL}/convertFile`;

      const response = await axios.post(conversionUrl, formData, {
        responseType: "blob",
        timeout: 600000,
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      link.setAttribute("download", `${fileNameWithoutExt}.${outputFormat}`);

      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      setSelectedFile(null);
      setDownloadError("");
      setConvert("File Converted Successfully!");
      setOutputFormat("pdf");

    } catch (error) {
      console.error("Error during file conversion:", error);

      let errorMessage = "An unknown error occurred. Please try again.";

      if (error.response) {
        try {
          await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function () {
              try {
                const errorData = JSON.parse(reader.result);
                errorMessage = `Error: ${errorData.message || 'Unknown server error.'}`;
                setDownloadError(errorMessage);
              } catch (e) {
                errorMessage = `Error occurred (Status: ${error.response.status}). Could not parse error details.`;
                setDownloadError(errorMessage);
              }
              resolve();
            };
            reader.onerror = function () {
              errorMessage = `Error occurred (Status: ${error.response.status}). Could not read error details.`;
              setDownloadError(errorMessage);
              resolve();
            };
            reader.readAsText(error.response.data);
          });
        } catch (e) {
          errorMessage = `Error occurred (Status: ${error.response.status}). Failed to process error response.`;
          setDownloadError(errorMessage);
        }
      } else if (error.request) {
        errorMessage = "Network error or server is unreachable. Please check your connection.";
        setDownloadError(errorMessage);
      } else {
        errorMessage = `An unexpected client-side error occurred: ${error.message}`;
        setDownloadError(errorMessage);
      }
      setConvert("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-screen-xl w-full mx-auto container">
          <div className="border-2 border-dashed px-4 py-8 md:px-12 md:py-10 border-indigo-400 rounded-lg shadow-xl bg-white bg-opacity-90">
            <h2 className="text-4xl font-extrabold text-center mb-6 text-indigo-700">
              File Converter
            </h2>
            <p className="text-md text-center mb-8 text-gray-600">
              Effortlessly convert a wide range of document, image, audio, and video formats.
              No software installation required, just upload and convert!
            </p>

            <div className="flex flex-col items-center space-y-6">
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="FileInput"
              />
              <label
                htmlFor="FileInput"
                className="w-full flex items-center justify-center px-6 py-8 bg-blue-50 text-gray-700 rounded-lg shadow-md cursor-pointer border-blue-300 hover:bg-blue-100 hover:border-blue-500 duration-300 transform hover:scale-105"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 512 512"
                  className="text-4xl mr-4 text-blue-600 w-10 h-10"
                >
                  <path
                    fill="currentColor"
                    d="M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3L135.4 206.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160c12.5-12.5 32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM448 416H64c-35.3 0-64 28.7-64 64s28.7 64 64 64H448c35.3 0 64-28.7 64-64s-28.7-64-64-64z"
                  />
                </svg>
                <span className="text-2xl font-semibold text-center">
                  {selectedFile ? selectedFile.name : "Choose or Drag File Here"}
                </span>
              </label>

              <div className="w-full text-center">
                <label htmlFor="outputFormat" className="block text-xl font-semibold mb-2 text-gray-700">
                  Convert to:
                </label>
                <select
                  id="outputFormat"
                  value={outputFormat}
                  onChange={handleOutputFormatChange}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                >
                  {commonOutputFormats.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!selectedFile || isLoading}
                className="w-full sm:w-auto text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:pointer-events-none duration-300 font-bold px-8 py-3 rounded-lg text-xl shadow-lg transform hover:-translate-y-1"
              >
                {isLoading ? "Converting..." : "Convert File"}
              </button>

              {convert && (
                <div className="text-green-600 text-center font-medium text-lg mt-4">{convert}</div>
              )}
              {downloadError && (
                <div className="text-red-600 text-center font-medium text-lg mt-4">{downloadError}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Home;
