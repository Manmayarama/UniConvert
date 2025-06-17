import React, { useState } from "react";
import { FaFileUpload } from "react-icons/fa";
import axios from "axios";

function Home() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [convert, setConvert] = useState("");
  const [downloadError, setDownloadError] = useState("");
  // New state for selected output format, default to 'pdf'
  const [outputFormat, setOutputFormat] = useState("pdf");
  // State for loading indicator
  const [isLoading, setIsLoading] = useState(false);

  // List of common output formats (you can expand this based on CloudConvert's support)
  const commonOutputFormats = [
    { value: "pdf", label: "PDF" },
    { value: "docx", label: "DOCX (Word)" },
    { value: "xlsx", label: "XLSX (Excel)" },
    { value: "pptx", label: "PPTX (PowerPoint)" },
    { value: "jpg", label: "JPG (Image)" },
    { value: "png", label: "PNG (Image)" },
    { value: "webp", label: "WebP (Image)" },
    { value: "mp4", label: "MP4 (Video)" }, // Be cautious with video, can be very slow/expensive
    { value: "mp3", label: "MP3 (Audio)" }, // Be cautious with audio
    { value: "txt", label: "TXT (Text)" },
    { value: "html", label: "HTML" },
    // Add more as needed, check CloudConvert's supported formats
  ];

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setConvert("");
    setDownloadError("");
  };

  // Handler for output format change
  const handleOutputFormatChange = (e) => {
    setOutputFormat(e.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      setConvert("Please select a file.");
      return;
    }

    setIsLoading(true); // Set loading state
    setConvert("Converting file, please wait...");
    setDownloadError("");

    const formData = new FormData();
    formData.append("file", selectedFile);
    // Append the selected output format
    formData.append("outputFormat", outputFormat);

    try {
      const backendUrl =
        process.env.NODE_ENV === "production"
          ? "/api/convertFile"
          : "http://localhost:3000/convertFile";

      const response = await axios.post(backendUrl, formData, {
        responseType: "blob",
        // Increased timeout significantly as conversions can take time
        timeout: 300000, // 5 minutes
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Determine the output filename based on the selected format
      const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      link.setAttribute("download", `${fileNameWithoutExt}.${outputFormat}`);

      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      setSelectedFile(null);
      setDownloadError("");
      setConvert("File Converted Successfully!");
      setOutputFormat("pdf"); // Reset output format to default after success

    } catch (error) {
      console.error("Error during file conversion:", error);

      let errorMessage = "An unknown error occurred. Please try again.";

      if (error.response) {
        // Try to read error message from backend if available
        // Note: For 'responseType: "blob"', error.response.data is a blob.
        // Need to read it as text.
        try {
          const reader = new FileReader();
          reader.onload = function () {
            const errorData = JSON.parse(reader.result);
            errorMessage = `Error: ${errorData.message || 'Unknown server error.'}`;
            setDownloadError(errorMessage);
          };
          reader.onerror = function () {
            errorMessage = `Error occurred (Status: ${error.response.status}). Could not read error details.`;
            setDownloadError(errorMessage);
          };
          reader.readAsText(error.response.data);
        } catch (e) {
          errorMessage = `Error occurred (Status: ${error.response.status}).`;
          setDownloadError(errorMessage);
        }
      } else if (error.request) {
        errorMessage = "Network error or server is unreachable. Please check your connection.";
        setDownloadError(errorMessage);
      } else {
        errorMessage = `An unexpected client-side error occurred: ${error.message}`;
        setDownloadError(errorMessage);
      }
      setConvert(""); // Clear any success message
    } finally {
      setIsLoading(false); // Clear loading state
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
              {/* Hidden file input */}
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="FileInput"
              />
              {/* Custom styled label for the file input */}
              <label
                htmlFor="FileInput"
                className="w-full flex items-center justify-center px-6 py-8 bg-blue-50 text-gray-700 rounded-lg shadow-md cursor-pointer border-blue-300 hover:bg-blue-100 hover:border-blue-500 duration-300 transform hover:scale-105"
              >
                <FaFileUpload className="text-4xl mr-4 text-blue-600" />
                <span className="text-2xl font-semibold text-center">
                  {selectedFile ? selectedFile.name : "Choose or Drag File Here"}
                </span>
              </label>

              {/* New: Output Format Selector */}
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

              {/* Convert button */}
              <button
                onClick={handleSubmit}
                disabled={!selectedFile || isLoading} // Disable when no file or loading
                className="w-full sm:w-auto text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:pointer-events-none duration-300 font-bold px-8 py-3 rounded-lg text-xl shadow-lg transform hover:-translate-y-1"
              >
                {isLoading ? "Converting..." : "Convert File"}
              </button>

              {/* Display messages */}
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