// index.js

// Load environment variables from .env file. This line ensures that
// process.env will have access to variables defined in your .env file
// when running locally.
require('dotenv').config();

const express = require("express"); // Web framework for Node.js
const multer = require("multer");   // Middleware for handling multipart/form-data (file uploads)
const cors = require("cors");       // Middleware for enabling Cross-Origin Resource Sharing
const path = require("path");       // Node.js path module for working with file and directory paths
const fs = require("fs");           // Node.js File System module (for file streams like createReadStream)
const fsp = require("fs").promises; // Node.js File System Promises API (for asynchronous file operations like unlink, mkdir)
const axios = require("axios");     // Promise-based HTTP client for the browser and Node.js
const FormData = require("form-data"); // For building multipart/form-data requests for external APIs

const app = express();
const port = 3000; // Port for your backend server to listen on

// Enable CORS for all origins. In a production environment, you might
// want to restrict this to specific origins (e.g., your frontend's domain).
app.use(cors());
// Parse JSON request bodies. This is important for receiving the outputFormat
// field from the frontend via req.body (Multer handles file parts).
app.use(express.json());

// Define a temporary directory for storing uploaded files.
// On Vercel (and other serverless platforms), only the /tmp directory is writable
// and is ephemeral (its contents are not persistent across invocations).
const uploadDir = '/tmp';

// Ensure the upload directory exists. 'recursive: true' will create parent
// directories if they don't already exist. Using fsp.mkdir for a promise-based
// asynchronous operation to avoid blocking the event loop.
fsp.mkdir(uploadDir, { recursive: true }).catch(console.error);

// Configure Multer for handling file storage.
const storage = multer.diskStorage({
    // Specify the destination directory where Multer should save uploaded files.
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    // Define the filename for the uploaded file to prevent naming conflicts.
    // A unique suffix is generated using a timestamp and a random number.
    // The original file extension is preserved.
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const fileExtension = path.extname(file.originalname);
        cb(null, `upload-${uniqueSuffix}${fileExtension}`);
    },
});

// Initialize Multer upload middleware with the defined storage configuration.
const upload = multer({ storage: storage });

// Define the POST route for handling file conversion requests.
app.post("/convertFile", async (req, res) => {
    // Middleware to handle file upload. It uses Multer's `single()` method
    // to process a single file upload named 'file'.
    // This is wrapped in a Promise to allow `async/await` syntax for better flow control.
    await new Promise((resolve, reject) => {
        upload.single("file")(req, res, (err) => {
            if (err) {
                // Log Multer-specific errors that occur during file upload.
                console.error("Multer upload error:", err);
                // Attempt to clean up any partially uploaded file if Multer failed.
                if (req.file && req.file.path) {
                    fsp.unlink(req.file.path).catch(console.error);
                }
                // Send a 400 Bad Request response to the client for upload failures.
                return res.status(400).json({ message: "File upload failed." });
            }
            resolve(); // Resolve the promise if the file upload is successful.
        });
    }); // <-- Closes the Promise block for Multer upload.

    // Outer try-catch block: This catches any high-level errors that might occur
    // during the overall file conversion process, including issues before
    // interacting with the CloudConvert API.
    try { // <-- Starts the OUTER TRY block.
        // Check if Multer successfully attached a file to the request.
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded." });
        }

        // Extract the desired output format from the request body.
        // Multer automatically populates `req.body` with non-file form fields.
        const { outputFormat } = req.body;

        // Validate that an output format was provided by the frontend.
        if (!outputFormat) {
            // Clean up the temporarily uploaded file if the output format is missing.
            await fsp.unlink(req.file.path).catch(console.error);
            return res.status(400).json({ message: "Output format is required." });
        }

        const inputFilePath = req.file.path;       // Full path to the temporarily stored uploaded file.
        const originalFileName = req.file.originalname; // Original filename from the client.
        // Extract the original file's extension (e.g., 'docx', 'png') by taking the substring after the dot.
        const inputExtension = path.extname(originalFileName).substring(1);
        // Extract the filename without its extension for use in the downloaded file name.
        const fileNameWithoutExt = path.parse(originalFileName).name;

        // Retrieve the CloudConvert API key from environment variables.
        const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;

        // Optional: Log a masked version of the API key for debugging if needed.
        // In production, ensure sensitive information is not logged.
        // console.log('Loaded API Key:', CLOUDCONVERT_API_KEY ? CLOUDCONVERT_API_KEY.substring(0, 8) + '...' + CLOUDCONVERT_API_KEY.substring(CLOUDCONVERT_API_KEY.length - 8) : 'NOT FOUND'); 

        // Check if the API key is successfully loaded.
        if (!CLOUDCONVERT_API_KEY) {
            console.error("CLOUDCONVERT_API_KEY is not set in environment variables!");
            // Clean up the uploaded file before responding with a server error.
            await fsp.unlink(inputFilePath).catch(console.error);
            return res.status(500).json({ message: "Server configuration error: CloudConvert API key missing." });
        }

        let cloudConvertJobResponse;
        // Inner try-catch block: This specifically handles errors during interactions
        // with the CloudConvert API (creating jobs, uploading files, polling).
        try { // <-- Starts the INNER TRY block for CloudConvert API calls.
            // Step 1: Create a CloudConvert Job. This defines the workflow:
            //   - 'upload-file': An import task to prepare for file upload.
            //   - 'convert-file': A conversion task that uses the uploaded file as input.
            //   - 'export-file': An export task to get a temporary URL for the converted file.
            cloudConvertJobResponse = await axios.post('https://api.cloudconvert.com/v2/jobs', {
                tasks: {
                    'upload-file': { // Name of the upload task
                        operation: 'import/upload', // Operation type: import via direct upload
                        filename: originalFileName, // Original filename for CloudConvert's internal tracking
                    },
                    'convert-file': { // Name of the conversion task
                        operation: 'convert', // Operation type: file conversion
                        input: 'upload-file', // Reference the 'upload-file' task as the input source
                        input_format: inputExtension, // Dynamic input format derived from original file
                        output_format: outputFormat, // Dynamic output format selected by user
                    },
                    'export-file': { // Name of the export task
                        operation: 'export/url', // Operation type: export to a temporary URL
                        input: 'convert-file', // Reference the 'convert-file' task as its input
                    },
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}`, // Authentication header
                    'Content-Type': 'application/json', // Specify JSON content type for this request
                }
            });

            // Validate the response from CloudConvert after creating the job.
            if (!cloudConvertJobResponse.data || !cloudConvertJobResponse.data.data || !cloudConvertJobResponse.data.data.id) {
                console.error('CloudConvert job creation failed: Invalid response from CloudConvert', cloudConvertJobResponse.data);
                await fsp.unlink(inputFilePath).catch(console.error);
                return res.status(500).json({ message: 'CloudConvert job creation failed or returned an invalid response.' });
            }

            const jobId = cloudConvertJobResponse.data.data.id;
            console.log(`CloudConvert Job created with ID: ${jobId}`);

            // Step 2: Poll the job to get the presigned URL for uploading the file.
            // CloudConvert's API is asynchronous. The presigned URL for 'import/upload' is not
            // immediately available in the initial job creation response; it needs to be fetched
            // by polling the job status.
            let uploadTask = null;
            // Increased polling attempts for the upload URL to give CloudConvert more time.
            const initialPollAttempts = 120; // Try for up to 120 seconds (2 minutes at 1-sec intervals)
            let currentInitialAttempt = 0;

            while (currentInitialAttempt < initialPollAttempts && !uploadTask) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before each poll.
                const currentJobStatusResponse = await axios.get(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
                    headers: {
                        'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}` // Authenticate polling requests.
                    }
                });

                // Attempt to find the 'upload-file' task.
                const tempUploadTask = currentJobStatusResponse.data?.data?.tasks?.find(
                    task => task.name === 'upload-file'
                );

                // CRITICAL FIX: Explicitly check for the URL and parameters at the correct nested level (task.result.form)
                // Also added more detailed logging for debugging.
                if (tempUploadTask) {
                    const hasUrl = typeof tempUploadTask.result?.form?.url === 'string' && tempUploadTask.result.form.url.length > 0;
                    const hasParams = typeof tempUploadTask.result?.form?.parameters === 'object' && tempUploadTask.result.form.parameters !== null && Object.keys(tempUploadTask.result.form.parameters).length > 0;

                    if (hasUrl && hasParams) {
                        uploadTask = tempUploadTask; // Assign the task if both URL and parameters are found.
                        console.log('SUCCESS: Found complete upload task URL and parameters after initial poll.');
                        break; // Exit the loop as we got what we needed.
                    } else {
                        console.log(`INFO: Upload task found (name: ${tempUploadTask.name}), but URL/parameters not yet ready. Current status: ${tempUploadTask.status}.`);
                        console.log(`DEBUG: hasUrl: ${hasUrl}, hasParams: ${hasParams}`);
                        console.log('Full upload task object (details pending):', JSON.stringify(tempUploadTask, null, 2));
                    }
                } else {
                    console.log('INFO: Upload task not yet found in job response.');
                }

                currentInitialAttempt++;
                console.log(`Initial poll for upload URL. Attempt ${currentInitialAttempt}/${initialPollAttempts}.`);
            }

            // If after all attempts, the upload task or its necessary details are still not found.
            if (!uploadTask || !uploadTask.result || !uploadTask.result.form || !uploadTask.result.form.url || !uploadTask.result.form.parameters) {
                console.error('Even after extensive initial polling, could not get upload task details or URL. Final job response:', cloudConvertJobResponse.data);
                await fsp.unlink(inputFilePath).catch(console.error);
                return res.status(500).json({ message: 'Failed to get CloudConvert upload URL after multiple attempts. Please try again or check CloudConvert status.' });
            }

            // Create FormData for the actual file upload to the presigned URL.
            // This FormData needs to include parameters provided by CloudConvert for the upload.
            const uploadForm = new FormData();
            // Use the parameters from `uploadTask.result.form.parameters`
            for (const key in uploadTask.result.form.parameters) {
                uploadForm.append(key, uploadTask.result.form.parameters[key]);
            }
            // Append the actual file data as a stream.
            uploadForm.append('file', fs.createReadStream(inputFilePath), {
                filename: originalFileName,
                contentType: req.file.mimetype,
            });

            // Step 3: Upload the file to the presigned URL provided by CloudConvert.
            // CloudConvert uses a POST request for multipart uploads to their presigned URLs.
            console.log(`Uploading file to CloudConvert via presigned URL: ${uploadTask.result.form.url}`);
            await axios.post(uploadTask.result.form.url, uploadForm, {
                headers: {
                    ...uploadForm.getHeaders(), // Get all headers including the 'Content-Type' with boundary
                    'Content-Type': `multipart/form-data; boundary=${uploadForm.getBoundary()}`, // Explicitly set Content-Type
                },
                maxContentLength: Infinity, // Allow very large request bodies
                maxBodyLength: Infinity,     // Allow very large request bodies
            });
            console.log('File uploaded to CloudConvert successfully.');

            // Step 4: Poll the main job status until it's 'finished' or 'error'.
            console.log(`Polling CloudConvert Job ${jobId} for overall completion...`);
            let jobStatusResponse;
            // Max overall polling attempts. 90 attempts * 5 seconds = 7.5 minutes total.
            const maxOverallPollAttempts = 90;
            let currentOverallAttempt = 0;

            while (currentOverallAttempt < maxOverallPollAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between polls.
                jobStatusResponse = await axios.get(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
                    headers: {
                        'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}` // Authenticate polling requests.
                    }
                });

                if (jobStatusResponse.data && jobStatusResponse.data.data) {
                    const jobStatus = jobStatusResponse.data.data.status;
                    console.log(`Polling job ${jobId}. Status: ${jobStatus}. Attempt ${currentOverallAttempt + 1}/${maxOverallPollAttempts}`);

                    if (jobStatus === 'finished') {
                        break; // Job is finished, exit loop.
                    }
                    if (jobStatus === 'error') {
                        // If the job failed, extract the error message and throw a custom error.
                        const errorMessage = jobStatusResponse.data.data.message || 'CloudConvert job failed with unknown error.';
                        throw new Error(`CloudConvert Job ${jobId} failed: ${errorMessage}`);
                    }
                }
                currentOverallAttempt++;
            }

            // Check if the job finished successfully within the polling limit.
            if (!jobStatusResponse || jobStatusResponse.data.data.status !== 'finished') {
                console.error('CloudConvert job did not finish in time or failed.');
                await fsp.unlink(inputFilePath).catch(console.error); // Clean up temp file.
                return res.status(500).json({ message: 'File conversion timed out or failed on CloudConvert.' });
            }

            // Step 5: Get the URL of the converted file from the finished job's 'export-file' task.
            const exportTask = jobStatusResponse.data.data.tasks.find(
                task => task.name === 'export-file' && task.result && task.result.files && task.result.files.length > 0
            );

            if (!exportTask || !exportTask.result.files[0] || !exportTask.result.files[0].url) {
                console.error('Could not find converted file URL in job response:', jobStatusResponse.data);
                await fsp.unlink(inputFilePath).catch(console.error); // Clean up temp file.
                return res.status(500).json({ message: 'Could not retrieve converted file URL from CloudConvert.' });
            }

            const fileUrl = exportTask.result.files[0].url; // The direct URL to the converted file.
            const convertedMimeType = exportTask.result.files[0].mime; // The MIME type of the converted file.

            // Step 6: Download the converted file stream and pipe it back to the client.
            console.log(`Downloading converted file from: ${fileUrl}`);
            // Use responseType: 'stream' for efficient handling of potentially large files.
            const fileResponse = await axios.get(fileUrl, { responseType: 'stream' });

            // Set response headers for the client's download.
            // 'Content-Type': Uses the actual MIME type from CloudConvert or a fallback.
            res.setHeader('Content-Type', convertedMimeType || `application/${outputFormat}`);
            // 'Content-Disposition': Tells the browser to download the file and suggests a filename.
            res.setHeader('Content-Disposition', `attachment; filename="${fileNameWithoutExt}.${outputFormat}"`);

            // Pipe the incoming file stream (from CloudConvert) directly to the client's response.
            fileResponse.data.pipe(res);

            // Event listener for when the stream finishes piping to the client.
            fileResponse.data.on('end', async () => {
                await fsp.unlink(inputFilePath).catch(console.error); // Clean up the temporary uploaded file.
                console.log('File successfully converted and sent to client. Temporary uploaded file deleted.');
            });

            // Event listener for errors during piping the stream to the client.
            fileResponse.data.on('error', async (streamErr) => {
                console.error('Error piping converted file stream to client:', streamErr);
                await fsp.unlink(inputFilePath).catch(console.error); // Clean up the temporary uploaded file.
                res.status(500).json({ message: 'Error streaming converted file to client.' });
            });

        } catch (cloudConvertApiError) { // <-- Closes the INNER TRY block and starts its CATCH.
            // This catches errors that specifically originate from CloudConvert API interactions (e.g., HTTP errors from axios calls).
            console.error("Error in CloudConvert API interaction:", cloudConvertApiError.response ? cloudConvertApiError.response.data : cloudConvertApiError.message);

            // Ensure the temporary uploaded file is deleted in case of API errors.
            if (req.file && req.file.path) {
                await fsp.unlink(req.file.path).catch(console.error);
            }

            // Extract and return CloudConvert's specific error message to the frontend, if available.
            const errorMessage = cloudConvertApiError.response?.data?.message || cloudConvertApiError.message;
            res.status(500).json({ message: `Conversion service error: ${errorMessage}` });
        } // <-- Closes the INNER CATCH block.

    } catch (outerError) { // <-- Closes the OUTER TRY block and starts its CATCH.
        // This catches any remaining unexpected errors that were not specifically handled
        // by the Multer promise or the inner CloudConvert API try-catch block.
        console.error("Unhandled server error in /convertFile:", outerError);

        // Ensure cleanup of the uploaded file for any unhandled error.
        if (req.file && req.file.path) {
            await fsp.unlink(req.file.path).catch(console.error);
        }

        // Provide a generic internal server error message to the frontend.
        let errorMessage = "Internal server error.";
        if (outerError.message) {
            errorMessage = outerError.message; // Use the specific error message if available.
        }
        res.status(500).json({ message: errorMessage });
    } // <-- Closes the OUTER CATCH block.

}); // <-- Closes the `app.post` callback function definition.

// Start the Express server. This is only done in development mode.
// In production (e.g., when deployed on Vercel), Vercel's environment
// manages the serverless function execution, so `app.listen` is not needed.
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is listening on port ${port} in development mode.`);
    });
}

// Export the Express app. This is crucial for Vercel's serverless function
// architecture, where the exported app becomes the handler for incoming requests.
module.exports = app;
