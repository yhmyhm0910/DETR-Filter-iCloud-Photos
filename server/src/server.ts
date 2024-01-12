import express, { Request, Response } from 'express'
import { PythonShell } from 'python-shell'
const cors = require('cors'); 
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const archiver = require('archiver')
const jwt = require('jsonwebtoken')
const app = express()

require('dotenv').config({path:__dirname+'/../.env'})
const port = process.env.PORT || 8000;
const secretKey = process.env.JWT_SECRET_KEY

let email: string = ''
let password: string = ''

app.use(cors());
app.use(bodyParser.json());

app.post('/login', (req: Request, res: Response) => {
  const loginInfo = req.body
  console.log('loginInfo while /login', loginInfo)

  // This is to login (and get auth number)
  const scriptPath_login = 'api/iCloud_part/login_iCloud.py'
  const scriptArgs = [loginInfo.email, loginInfo.password]
  const pyShell_login = new PythonShell(scriptPath_login, { args: scriptArgs })

  pyShell_login.on('message', (message) => {
    console.log(`message from login: ${message}`)
  })

  pyShell_login.end((err, code, signal) => {
    if (err) {
      console.error(`Python script execution error: ${err}`);
      res.status(500).send('Error executing Python script');
    } else {
      console.log(`Python script executed with code ${code}`);
      res.status(200).send('Login for two-factor executed successfully');
    }
  })
})

app.post('/download', (req: Request, res: Response) => {
  const loginInfo = req.body
  console.log('loginInfo: ', loginInfo)

  // set as global for future use (delete)
  email = loginInfo.email
  password = loginInfo.password

  // This is to download to public/img_from_iCloud
  const scriptPath = 'api/iCloud_part/download_from_iCloud.py'
  const scriptArgs = [loginInfo.startDate, loginInfo.endDate, loginInfo.email, loginInfo.password, loginInfo.auth_code]
  const pyShell = new PythonShell(scriptPath, { args: scriptArgs })

  const token = jwt.sign({startDate: loginInfo.startDate, endDate: loginInfo.endDate}, secretKey, { expiresIn: '1h' });
  console.log(token)

  pyShell.on('message', (message) => {
    console.log(`Python script output: ${message}`);
    
    if (message === 'Successfully operated.')
      res.json(token)
  });

  pyShell.end((err, code, signal) => {
    if (err) {
      console.error(`Python script execution error: ${err}`);
      res.status(500).send('Error executing Python script');
    } else {
      console.log(`Python script executed with code ${code}. Finish downloading requested photos to public/img_from_iCloud`);
      //res.status(200).send('Python script executed successfully');
    }
  });
})

// Called when accessing Main page
app.get('/allFiles', (req, res) => {

  // DETR
  const scriptPath = 'image_obj_identify/object_identify.py'
  const pyShell = new PythonShell(scriptPath)
  
  pyShell.on('message', (message) => {
    console.log(`Python script output: ${message}`)
  });

  pyShell.end((err, code, signal) => {
    if (err) {
      console.error(`DETR Python script execution error: ${err}`)
    } else {
      console.log(`Python script executed with code ${code}. Finished object identifying. Images and JSONs are placed inside public/img_after_DETR`)
      
      const filesDirectory = path.join(__dirname, '../public', 'img_after_DETR')
      // Use fs.readdir to list all files in the directory
      fs.readdir(filesDirectory, (err: Error, fileNames: string[]) => {
        if (err) {
          console.error('Error reading directory:', err);
          return res.status(500).json({ error: 'Internal Server Error' })
        }
    
        // Create a writable stream to send the ZIP archive as a response
        const archive = archiver('zip', {
          zlib: { level: 9 }, // Compression level (optional)
        })
    
        // Pipe the ZIP archive to the response
        archive.pipe(res)
    
        // Iterate through the file names and add each file to the ZIP archive
        fileNames.forEach((fileName: string) => {
          const filePath = path.join(filesDirectory, fileName)
    
          // Append the file to the ZIP archive
          archive.append(fs.createReadStream(filePath), { name: fileName })
    
          console.log(fileName, 'is added')
        })
    
        // Finalize the ZIP archive and send it as the response
        archive.finalize()
        console.log('Sent all files to frontend already')
      })
    }
  })
})

app.post('/uploadFiles', (req: Request, res: Response) => {
  try {
    const filenames_full = req.body
    console.log('filenames_full when /uploadFiles', filenames_full)
    const filenames: string[] = filenames_full.map((item: string) => item.replace(/^processed_/i, ''))
  
    console.log(filenames)
  
    const filenames_toDelete: string[] = []

    const copyFile = (source: any, destination: any) => {
      fs.copyFileSync(source, destination)
      console.log(`File copied from ${source} to ${destination}`)
    }
  
    const copyFilesInDirectory = (sourceDir: any, destinationDir: any) => {
      const files = fs.readdirSync(sourceDir);
  
      files.forEach((file: string) => {
        if (!(file.endsWith('.json'))) {
          const file_strip = file.replace(/\.[^/.]+$/, '')
          if (filenames.includes(file_strip)) {
            const sourceFile = path.join(sourceDir, file);
            const destinationFile = path.join(destinationDir, file);
        
            copyFile(sourceFile, destinationFile);
          } else {
            filenames_toDelete.push(file)
          }
        }
      })
    }
  
    const deleteDirectory = (directory: string) => {
      fs.readdir(directory, (err: Error, files: string[]) => {
        if (err) {
          console.log('Error reading directory:', err);
          return;
        }
        files.forEach((file: string) => {
          const filePath = path.join(directory, file);

          fs.unlink(filePath, (err: Error) => {
            if (err) {
              console.log('Error deleting file:', err);
            } else {
              console.log('File deleted:', filePath);
            }
          });
        });
      });
    }
  
    // Copy files from source to destination
    copyFilesInDirectory('public/img_from_iCloud', 'saved_images')
  
    // Delete the source directory
    deleteDirectory('public/img_after_DETR')
    deleteDirectory('public/img_from_iCloud')

    res.status(200).send('file received by server.')

  } catch (err) {
    console.log(err)
    res.status(500).send(`Internal Server Error: ${err}`)
  }

})

app.post('/deleteiCloudFiles', (req: Request, res: Response) => {
  const startDate = req.body[0]
  const endDate = req.body[1]
  const filenames_full = req.body.slice(2);
  const filenames: string[] = filenames_full.map((item: string) => item.replace(/^processed_/i, ''))
  // This is to delete from iCloud
  const scriptPath = 'api/iCloud_part/delete_from_iCloud.py'
  const scriptArgs = [startDate, endDate, email, password, ...filenames]
  const pyShell = new PythonShell(scriptPath, { args: scriptArgs })

  pyShell.on('message', (message) => {
    console.log(`message from delete script: ${message}`)
  })

  pyShell.end((err, code, signal) => {
    if (err) {
      console.error(`Python script execution error: ${err}`)
      res.status(500).send('Error executing Python script')
    } else {
      console.log(`Python script executed with code ${code}. Finish deleting unwanted photos from iCloud`)
      res.status(200).send('Success delete')
    }
  });
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
