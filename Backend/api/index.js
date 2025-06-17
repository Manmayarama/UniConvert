// index.js

// Load environment variables from .env file.
require('dotenv').config();

const express = require("express");
const multer = require("multer");
const cors = require("cors"); // Import the CORS middleware
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const port = 3000;

// Configure CORS to explicitly allow your frontend's origin
const corsOptions = {
  origin: 'https://uni-convert-seven.vercel.app', // Your frontend's deployed URL
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allowed HTTP methods
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 204 // For preflight requests
};
app.use(cors(corsOptions)); // Apply CORS with specific options

// Parse JSON request bodies
app.use(express.json());

const uploadDir = '/tmp'; 
fsp.mkdir(uploadDir, { recursive: true }).catch(console.error); 

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, `upload-${uniqueSuffix}${fileExtension}`);
  },
});

const upload = multer({ storage: storage });

app.post("/convertFile", async (req, res) => {
  await new Promise((resolve, reject) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer upload error:", err);
        if (req.file && req.file.path) {
          fsp.unlink(req.file.path).catch(console.error);
        }
        return res.status(400).json({ message: "File upload failed." });
      }
      resolve();
    });
  });

  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const { outputFormat } = req.body;
    if (!outputFormat) {
        await fsp.unlink(req.file.path).catch(console.error);
        return res.status(400).json({ message: "Output format is required." });
    }

    const inputFilePath = req.file.path;
    const originalFileName = req.file.originalname;
    const inputExtension = path.extname(originalFileName).substring(1);
    const fileNameWithoutExt = path.parse(originalFileName).name;

    const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;
    if (!CLOUDCONVERT_API_KEY) {
      console.error("CLOUDCONVERT_API_KEY is not set in environment variables!");
      await fsp.unlink(inputFilePath).catch(console.error); 
      return res.status(500).json({ message: "Server configuration error: CloudConvert API key missing." });
    }

    let cloudConvertJobResponse;
    try {
      cloudConvertJobResponse = await axios.post('https://api.cloudconvert.com/v2/jobs', {
        tasks: {
          'upload-file': {
            operation: 'import/upload',
            filename: originalFileName,
          },
          'convert-file': {
            operation: 'convert',
            input: 'upload-file',
            input_format: inputExtension,
            output_format: outputFormat,
          },
          'export-file': {
            operation: 'export/url',
            input: 'convert-file',
          },
        }
      }, {
        headers: {
          'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}`,
          'Content-Type': 'application/json',
        }
      });

      if (!cloudConvertJobResponse.data || !cloudConvertJobResponse.data.data || !cloudConvertJobResponse.data.data.id) {
          console.error('CloudConvert job creation failed: Invalid response from CloudConvert', cloudConvertJobResponse.data);
          await fsp.unlink(inputFilePath).catch(console.error);
          return res.status(500).json({ message: 'CloudConvert job creation failed or returned an invalid response.' });
      }

      const jobId = cloudConvertJobResponse.data.data.id;
      console.log(`CloudConvert Job created with ID: ${jobId}`);

      let uploadTask = null;
      const initialPollAttempts = 120;
      let currentInitialAttempt = 0;

      while (currentInitialAttempt < initialPollAttempts && !uploadTask) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const currentJobStatusResponse = await axios.get(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
              headers: {
                  'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}`
              }
          });

          const tempUploadTask = currentJobStatusResponse.data?.data?.tasks?.find(
            task => task.name === 'upload-file'
          );
          
          if (tempUploadTask) {
              const hasUrl = typeof tempUploadTask.result?.form?.url === 'string' && tempUploadTask.result.form.url.length > 0;
              const hasParams = typeof tempUploadTask.result?.form?.parameters === 'object' && tempUploadTask.result.form.parameters !== null && Object.keys(tempUploadTask.result.form.parameters).length > 0;

              if (hasUrl && hasParams) {
                  uploadTask = tempUploadTask;
                  console.log('SUCCESS: Found complete upload task URL and parameters after initial poll.');
                  break;
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

      if (!uploadTask || !uploadTask.result || !uploadTask.result.form || !uploadTask.result.form.url || !uploadTask.result.form.parameters) {
          console.error('Even after extensive initial polling, could not get upload task details or URL. Final job response:', cloudConvertJobResponse.data);
          await fsp.unlink(inputFilePath).catch(console.error);
          return res.status(500).json({ message: 'Failed to get CloudConvert upload URL after multiple attempts. Please try again or check CloudConvert status.' });
      }

      const uploadForm = new FormData();
      for (const key in uploadTask.result.form.parameters) {
          uploadForm.append(key, uploadTask.result.form.parameters[key]);
      }
      uploadForm.append('file', fs.createReadStream(inputFilePath), {
          filename: originalFileName,
          contentType: req.file.mimetype,
      });

      console.log(`Uploading file to CloudConvert via presigned URL: ${uploadTask.result.form.url}`);
      await axios.post(uploadTask.result.form.url, uploadForm, { 
        headers: {
          ...uploadForm.getHeaders(),
          'Content-Type': `multipart/form-data; boundary=${uploadForm.getBoundary()}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      console.log('File uploaded to CloudConvert successfully.');

      console.log(`Polling CloudConvert Job ${jobId} for overall completion...`);
      let jobStatusResponse;
      const maxOverallPollAttempts = 90;
      let currentOverallAttempt = 0;

      while (currentOverallAttempt < maxOverallPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          jobStatusResponse = await axios.get(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
              headers: {
                  'Authorization': `Bearer ${CLOUDCONVERT_API_KEY}`
              }
          });

          if (jobStatusResponse.data && jobStatusResponse.data.data) {
              const jobStatus = jobStatusResponse.data.data.status;
              console.log(`Polling job ${jobId}. Status: ${jobStatus}. Attempt ${currentOverallAttempt + 1}/${maxOverallPollAttempts}`);

              if (jobStatus === 'finished') {
                  break;
              }
              if (jobStatus === 'error') {
                  const errorMessage = jobStatusResponse.data.data.message || 'CloudConvert job failed with unknown error.';
                  throw new Error(`CloudConvert Job ${jobId} failed: ${errorMessage}`);
              }
          }
          currentOverallAttempt++;
      }

      if (!jobStatusResponse || jobStatusResponse.data.data.status !== 'finished') {
          console.error('CloudConvert job did not finish in time or failed.');
          await fsp.unlink(inputFilePath).catch(console.error);
          return res.status(500).json({ message: 'File conversion timed out or failed on CloudConvert.' });
      }

      const exportTask = jobStatusResponse.data.data.tasks.find(
          task => task.name === 'export-file' && task.result && task.result.files && task.result.files.length > 0
      );
      
      if (!exportTask || !exportTask.result.files[0] || !exportTask.result.files[0].url) {
          console.error('Could not find converted file URL in job response:', jobStatusResponse.data);
          await fsp.unlink(inputFilePath).catch(console.error);
          return res.status(500).json({ message: 'Could not retrieve converted file URL from CloudConvert.' });
      }

      const fileUrl = exportTask.result.files[0].url;
      const convertedMimeType = exportTask.result.files[0].mime;

      console.log(`Downloading converted file from: ${fileUrl}`);
      const fileResponse = await axios.get(fileUrl, { responseType: 'stream' });

      res.setHeader('Content-Type', convertedMimeType || `application/${outputFormat}`);
      res.setHeader('Content-Disposition', `attachment; filename="${fileNameWithoutExt}.${outputFormat}"`);

      fileResponse.data.pipe(res);

      fileResponse.data.on('end', async () => {
        await fsp.unlink(inputFilePath).catch(console.error); 
        console.log('File successfully converted and sent to client. Temporary uploaded file deleted.');
      });

      fileResponse.data.on('error', async (streamErr) => {
        console.error('Error piping converted file stream to client:', streamErr);
        await fsp.unlink(inputFilePath).catch(console.error); 
        res.status(500).json({ message: 'Error streaming converted file to client.' });
      });

    } catch (cloudConvertApiError) {
        console.error("Error in CloudConvert API interaction:", cloudConvertApiError.response ? cloudConvertApiError.response.data : cloudConvertApiError.message);
        
        if (req.file && req.file.path) {
            await fsp.unlink(req.file.path).catch(console.error); 
        }

        const errorMessage = cloudConvertApiError.response?.data?.message || cloudConvertApiError.message;
        res.status(500).json({ message: `Conversion service error: ${errorMessage}` });
    }

  } catch (outerError) {
    console.error("Unhandled server error in /convertFile:", outerError);
    
    if (req.file && req.file.path) {
      await fsp.unlink(req.file.path).catch(console.error); 
    }

    let errorMessage = "Internal server error.";
    if (outerError.message) {
        errorMessage = outerError.message;
    }
    res.status(500).json({ message: errorMessage });
  }

});

// A simple health check endpoint (if you decide to use it later, it's ready)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Backend operational', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is listening on port ${port} in development mode.`);
  });
} else {
  // In production (Vercel), log that the function is ready to handle requests.
  console.log('Serverless Function initialized and ready to handle requests.');
}

module.exports = app;
