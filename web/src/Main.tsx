import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import JSZip from 'jszip';
import { Buffer } from 'buffer';
import heic2any from 'heic2any';
import Cookies from 'js-cookie';
import { useNavigate } from 'react-router-dom';

function App() {

  interface obj {
    objects_confidence: number[]
    objects_identified: string[]
  }
  interface details {
    date: string
    obj: obj
  }
  interface finalImageDetails {
    id: string // name of the image file
    blobURL: string
    details: details
  }
  interface imagesDetails_photo {
    id: string // name of the image file
    blobURL: string
  }
  interface imagesDetails_json {
    id: string // name of the image file
    details: details
  }

  const [imagesDetails_photo, setImagesDetails_photo] = useState<imagesDetails_photo[]>([])
  const [imagesDetails_json, setImagesDetails_json] = useState<imagesDetails_json[]>([])
  const [finalImageDetails, setFinalImageDetails] = useState<finalImageDetails[]>([])
  const [finalImageDetails_sorted, setFinalImageDetails_sorted] = useState<finalImageDetails[]>([])
  const [finalImageDetails_sorted_wPerson, setFinalImageDetails_sorted_wPerson] = useState<finalImageDetails[]>([])
  const [finalImageDetails_sorted_woPerson, setFinalImageDetails_sorted_woPerson] = useState<finalImageDetails[]>([])

  const [isUnzipping, setIsUnzipping] = useState<Boolean>(false)
  const [isDETRing, setIsDETRing] = useState<Boolean>(true)
  const [isErrorFetching, setIsErrorFetching] = useState<Boolean>(false)

  const peopleImagesRef = useRef<Array<HTMLImageElement | null>>([])
  const noPeopleImagesRef = useRef<Array<HTMLImageElement | null>>([])
  const [uploadingFilesName, setUploadingFilesName] = useState<String[]>([])
  const [finishedAll, setFinishedAll] = useState<Boolean>(false)

  const [isLoadingMoveDelete, setIsLoadingMoveDelete] = useState<Boolean>(false)
  const [isDeleted, setIsDeleted] = useState<Boolean>(false)

  const navigate = useNavigate()

  useEffect(() => {
    console.log(imagesDetails_photo)
    console.log(imagesDetails_json)
    if (imagesDetails_photo.length === imagesDetails_json.length) {
      const temp: imagesDetails_json[] = new Array
      let counter = 0

      // loop through imagesDetails_photo
      for (let i=0; i<imagesDetails_photo.length; i++) {
        const obj_to_be_matched = imagesDetails_photo[i]
        let found = false
        // loop through temp
        console.log(temp.length)
        for (let h=0; h<temp.length; h++) {
          //console.log(1)
          if (temp[h].id === obj_to_be_matched.id) {
            setFinalImageDetails(prev => [...prev, Object.assign({}, obj_to_be_matched, temp[h])])
            found = true
            break;
          }   
        }

        if (!found) {
          // loop through imagesDetails_json
          for (let k=counter; k<imagesDetails_json.length; k++) {
            if (imagesDetails_json[k].id === obj_to_be_matched.id) {
              setFinalImageDetails(prev => [...prev, Object.assign({}, obj_to_be_matched, imagesDetails_json[k])])
              counter = k+1
              break;
            } else {
              temp.push(imagesDetails_json[k])
            }
          }
        }
      }
    } else {
      console.log('Still waiting for the full file. imageDetails_photo.length !== imagesDetails_json.length')
    }
  }, [imagesDetails_photo, imagesDetails_json])

  useEffect(() => {
    console.log('finalImageDetails: ',finalImageDetails)
    
    const byDate = (a: finalImageDetails, b: finalImageDetails) => {
      return new Date(a.details.date).valueOf() - new Date(b.details.date).valueOf()
    }
    const temp_finalImageDetails = finalImageDetails
    temp_finalImageDetails.sort(byDate)

    setFinalImageDetails_sorted(temp_finalImageDetails)

  }, [finalImageDetails])

  useEffect(() => {
    const temp_finalImageDetails_sorted = finalImageDetails_sorted
    const temp_wPerson = []
    const temp_woPerson = []
    for (let i=0; i<temp_finalImageDetails_sorted.length; i++) {
      if (finalImageDetails[i].details.obj.objects_identified.includes('person')) {
        temp_wPerson.push(finalImageDetails[i])
      } else {
        temp_woPerson.push(finalImageDetails[i])
      }
    }
    setIsUnzipping(false)
    setFinalImageDetails_sorted_wPerson(temp_wPerson)
    setFinalImageDetails_sorted_woPerson(temp_woPerson)
  }, [finalImageDetails_sorted])

  useEffect(() => {
    const token = Cookies.get('jwt')
    if (token === undefined) {
      navigate('/login')
      return;
    }

    console.log('token: ',token)
    axios
      .get('http://localhost:8000/allFiles', { responseType: 'blob' }) // Request the ZIP file as a blob
      .then((response) => {
        setIsDETRing(false)
        setIsUnzipping(true)
        const zipBlob = response.data

        // Create a new instance of JSZip
        const zip = new JSZip()

        // Use JSZip to unzip the ZIP file
        zip.loadAsync(zipBlob).then((zip) => {
          // Iterate through the files in the ZIP archive
          zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
              // Extract the file data as a Uint8Array
              zipEntry.async('uint8array').then((fileData) => {
                // Convert the Uint8Array to a Buffer
                const buffer = Buffer.from(fileData)

                const fileName_full = zipEntry.name
                const extension = fileName_full.split('.').pop() || ''
                const fileName = fileName_full.replace(/\.[^.]+$/, '')
                switch (extension.toLowerCase()) {
                  case 'jpg':
                  case 'jpeg':
                  case 'png':
                    const blob_normal = new Blob([buffer])
                    const imageURL = URL.createObjectURL(blob_normal)
                    setImagesDetails_photo(prev => [...prev, {id: fileName, blobURL: imageURL}]) 
                    break;
                  case 'heic':
                    const blob = new Blob([buffer])
                    const conversion_result = heic2any({blob})
                      .then((result) => {
                        console.log('RESULT:', result)
                        if (Array.isArray(result)) {
                          console.log('Blob is expected instead of Blob[] when translating HEIC to PNG.')
                          return ''
                        } else {
                          const imageURL = URL.createObjectURL(result)
                          setImagesDetails_photo(prev => [...prev, {id: fileName, blobURL: imageURL}])
                        }
                      })
                      .catch ((e) => {
                        console.log('Error while translating .HEIC images: ', e)
                      })
                    break;
                  case 'json':
                    // Decode buffer -> str -> json
                    const decoder = new TextDecoder('utf-8')
                    const buffer_str = decoder.decode(buffer)
                    const res_json = JSON.parse(buffer_str)
                    console.log(res_json)
                    setImagesDetails_json(prev => [...prev, 
                      {id: fileName, 
                        details: {
                          date: res_json.added_date,
                          obj: res_json.object
                      }}])
                    break;
                  default:
                    console.log('DEV TIME. NEW TYPES~')
                  break;
                }
              })
            }
          })  
        })
      })
      .catch((error) => {
        console.error('Error fetching ZIP file:', error)
        setIsDETRing(false)
        setIsUnzipping(false)
        setIsErrorFetching(true)
      })
  }, [])

  useEffect(() => {
    if (finishedAll) {
      console.log(uploadingFilesName)
      console.log('Sending request to server')

      // if not initial and pressed submit button, post file name back to server
      axios.post('http://localhost:8000/uploadFiles', uploadingFilesName)
      .then((response) => {
        console.log(response)

        // after finish upload to NAS, delete from iCloud
        axios.post('http://localhost:8000/deleteiCloudFiles', [Cookies.get('start_date'), Cookies.get('end_date'), ...uploadingFilesName])
        .then((res) => {
          console.log(res)
          if (res.data === 'Success delete') {
            setIsDeleted(true)
          }
        })
        .catch((err) => {
          console.log(`Error while deleting iCloud original: ${err}`)
        })
      })
      .catch((error) => {
        console.log(`Error: ${error}`)
      })

    }
  }, [finishedAll])

  function toTrtTimezone(date: string) {
    const date_date = new Date(date)
    const trtTime = date_date.toLocaleString("en-US", {timeZone: "America/Toronto"})
    return trtTime
  }

  const printObjs = (info: finalImageDetails) => {
    const objs: any[] = []
    for (let i=0; i<info.details.obj.objects_identified.length; i++) {
      objs.push(info.details.obj.objects_identified[i], info.details.obj.objects_confidence[i])
    }
    return objs
  }

  const choosePeopleImg = (index: number): React.MouseEventHandler<HTMLImageElement> => {
    return (event) => {
      const imageElement = peopleImagesRef.current[index]

      if (imageElement && imageElement.style.border !== '10px solid red') {
        imageElement.style.border = '10px solid red'
      } else {
        // Remove the blur effect
        imageElement?.style.removeProperty('border')
      }
    };
  }

  const chooseNoPeopleImg = (index: number): React.MouseEventHandler<HTMLImageElement> => {
    return (event) => {
      const imageElement = noPeopleImagesRef.current[index]

      if (imageElement && imageElement.style.border !== '10px solid red') {
        imageElement.style.border = '10px solid red'
      } else {
        // Remove the blur effect
        imageElement?.style.removeProperty('border')
      }
    };
  }

  const delete_and_upload = () => {
    for (let i=0; i<peopleImagesRef.current.length; i++) {
      if (peopleImagesRef.current[i] && peopleImagesRef.current[i]!.style.border === '10px solid red') {
        setUploadingFilesName(prev => [...prev, peopleImagesRef.current[i]!.alt])
      }
    }
    for (let i=0; i<noPeopleImagesRef.current.length; i++) {
      if (noPeopleImagesRef.current[i] && noPeopleImagesRef.current[i]!.style.border === '10px solid red') {
        setUploadingFilesName(prev => [...prev, noPeopleImagesRef.current[i]!.alt])
      }
    }
    setFinishedAll(true)
    setIsLoadingMoveDelete(true)
  }

  return (
    <div className="App">
      <div style={{display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center', 
        margin: '2vh'}}>
        <h1>iCloud Images from&nbsp;
          <u>{Cookies.get('start_date')}</u> 
          &nbsp;to&nbsp;
          <u>{Cookies.get('end_date')}</u>
        </h1>
        <div style={{display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        color: 'red' }}>
          {isDETRing && <h4>Object Identifying... (It is a local server only. Please be patient.)</h4>}
          {isUnzipping && <h4>Converting .HEIC to browser-supported format...</h4>}
          {isErrorFetching && <h4>Internal Server Error</h4>}
        </div>
      </div>

      
      <div style={{width: '80vw', display: 'block', margin: 'auto'}}>
        {!isDETRing && !isUnzipping && <p style={{fontSize: '40px', fontWeight: 'bold', textDecoration: 'underline', color: 'red'}}>
          Images with People
        </p>}
        <div style={{display: 'grid', 
        gridGap: '5px',
        gridTemplateColumns: '20vw 20vw 20vw 20vw', 
        alignItems: 'center', 
        alignContent: 'center',
        backgroundColor: 'black'}} >
        {finalImageDetails_sorted_wPerson.map((info, index) => (
          <div style={{backgroundColor: 'white', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <img src={info.blobURL} 
            onClick={choosePeopleImg(index)}
            key={index}
            alt={info.id}
            style={{
            width: 'auto', 
            height: 'auto', 
            maxWidth: '30vh', 
            maxHeight: '30vh',
            display: 'block',
            margin: 'auto',
            border: '10px solid red'
            }}
            ref={el => peopleImagesRef.current[index] = el} />

            <div>
              <p>{toTrtTimezone(info.details.date)}</p>
              {printObjs(info).map((objs, index) => (
                (index % 2 === 0) ? 
                  <>{objs}:{ }</> 
                  : <>{objs}<br/></>
              ))}
            </div>
            </div>
          )
        )}
        </div>
      </div>

      <div style={{width: '80vw', display: 'block', margin: 'auto'}}>
      {!isDETRing && !isUnzipping && <p style={{fontSize: '40px', fontWeight: 'bold', textDecoration: 'underline', color: 'orange'}}>
          Images without People
        </p>}
        <div style={{display: 'grid', 
          gridGap: '5px', 
          gridTemplateColumns: '20vw 20vw 20vw 20vw', 
          alignItems: 'center', 
          alignContent: 'center',
          backgroundColor: 'black'}} >
          {finalImageDetails_sorted_woPerson.map((info, index) => (
            <div style={{backgroundColor: 'white', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
              <img src={info.blobURL} 
              onClick={chooseNoPeopleImg(index)}
              key={index}
              alt={info.id}
              style={{
              width: 'auto', 
              height: 'auto', 
              maxWidth: '30vh', 
              maxHeight: '30vh',
              display: 'block',
              margin: 'auto'
              }}
              ref={el => noPeopleImagesRef.current[index] = el} />

              <div>
                <p>{toTrtTimezone(info.details.date)}</p>
                {printObjs(info).map((objs, index) => (
                  (index % 2 === 0) ? 
                    <>{objs}:{ }</> 
                    : <>{objs}<br/></>
                ))}
              </div>
            </div>
            )
          )}
        </div>
      </div>
      <div style={{width: '80vw', display: 'flex', margin: 'auto', alignItems: 'center'}}>
        {!isDETRing && !isUnzipping && <button type="submit" className="btn btn-primary" onClick={delete_and_upload}>
          Delete from iCloud & Save locally.
        </button>}
        <div style={{marginLeft: '3vw'}}>
          {isLoadingMoveDelete && !isDeleted && <div style={{textAlign: 'center', fontWeight: 'bold'}}>Request Sent to server. Loading.</div>}
          {isDeleted && <div style={{textAlign: 'center', color: 'green', fontWeight: 'bold'}}>Successfully deleted unwanted and move selected to server.</div>}
        </div>
      </div>
    </div>
  );
}

export default App;
