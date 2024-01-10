from transformers import DetrImageProcessor, DetrForObjectDetection
import torch
from PIL import Image, ImageDraw
import concurrent.futures
import multiprocessing
import os
import json
from pillow_heif import register_heif_opener
#import time

def photo_obj_identify(image):
    processor = DetrImageProcessor.from_pretrained("facebook/detr-resnet-50")
    model = DetrForObjectDetection.from_pretrained("facebook/detr-resnet-50")

    inputs = processor(images=image, return_tensors="pt")
    outputs = model(**inputs)

    # convert outputs (bounding boxes and class logits) to COCO API
    # let's only keep detections with score > 0.9
    target_sizes = torch.tensor([image.size[::-1]])
    results = processor.post_process_object_detection(outputs, target_sizes=target_sizes, threshold=0.9)[0]
    
    result = []

    for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
        box = [round(i, 2) for i in box.tolist()]
        '''print(
            f"Detected {model.config.id2label[label.item()]} with confidence "
            f"{round(score.item(), 3)} at location {box}"
        )'''
        result.append({'detected_obj': model.config.id2label[label.item()], 'confidence': round(score.item(), 3), 'location': box})

    return result

def draw_rectangle_on_img(image, coordinates):
    # draw on the image
    draw = ImageDraw.Draw(image)
    colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']
    for i, coordinate in enumerate(coordinates):
        draw.rectangle(coordinate, outline=colors[i%len(colors)], width=5)
    return image

def deleteExistingFiles():
    # change to '../public/img_after_DETR' when directly executed
    directory_path = 'public/img_after_DETR'

    file_list = os.listdir(directory_path)

    for filename in file_list:
        file_path = os.path.join(directory_path, filename)
        
        os.remove(file_path)

    '''print(f'All files in {directory_path} have been deleted.')'''

def worker(img_path, filename):

    if '.heic' or '.HEIC' in img_path:
        register_heif_opener()
    image = Image.open(img_path)
    obj_identify_result = photo_obj_identify(image)
    result_objects = [result['detected_obj'] for result in obj_identify_result]
    result_locations = [result['location'] for result in obj_identify_result]
    result_confidence = [result['confidence'] for result in obj_identify_result]
    '''print(result_objects, img_path)
    print(result_locations)
    print(result_confidence)'''

    result_img = draw_rectangle_on_img(image, result_locations)
    # with open won't work in this idk why
    result_img.save(f'public/img_after_DETR/processed_{filename}')

    original_json_path = f'public/img_from_iCloud/{os.path.splitext(filename)[0]}.json'
    with open(original_json_path, "r") as file:
        existing_data = json.load(file)

    appending_data = {
        "object": {
            "objects_identified": result_objects,
            "objects_confidence": result_confidence
        }
    }
    existing_data.update(appending_data)
    
    # write to dir: img_after_DETR
    with open(f'public/img_after_DETR/processed_{os.path.splitext(filename)[0]}.json', 'w') as opened_json:
        json.dump(existing_data, opened_json, indent=4)


if __name__ == '__main__':
    # Start
    #start_time = time.time()
    # delete original existing files
    deleteExistingFiles()

#-------------------concurrent------------------------------

    # Create a ThreadPoolExecutor with a number of threads based on available CPU cores
    with concurrent.futures.ThreadPoolExecutor(max_workers=multiprocessing.cpu_count()) as executor:
        image_extensions = [".jpg", ".jpeg", ".png", ".heic"]

        # path to original folder
        # change to '../public/img_from_iCloud' when directly execute
        directory_path = 'public/img_from_iCloud'
        file_list = os.listdir(directory_path)

        for filename in file_list:
            # if not .json
            if any(ext in filename.lower() for ext in image_extensions):
                file_path = os.path.join(directory_path, filename)
                executor.submit(worker, file_path, filename)
    
#-------------------concurrent------------------------------

#--------------------parallelism-------------------------
    '''image_extensions = [".jpg", ".jpeg", ".png", ".heic"]

    # path to original folder
    directory_path = '../public/img_from_iCloud'
    file_list = os.listdir(directory_path)

    # Create and start multiple processes
    processes = []
    for filename in file_list:
        # if not .json
        if any(ext in filename.lower() for ext in image_extensions):
            file_path = os.path.join(directory_path, filename)
            process = multiprocessing.Process(target=worker, args=(file_path, filename))
            processes.append(process)
            process.start()

    # Wait for all processes to finish
    for process in processes:
        process.join()
'''
#-------------------parallelism----------------------
    #end_time = time.time()
    #used_time = end_time - start_time
    '''print('TIME USED: ', used_time)
    print('Successfully operated.')'''


    # concurrent time used: 42s
    # concurrent when tasks more than CPU cores and need much I/O bound tasks
    # parallel time used: 149s
    # parallel when tasks less than CPU cores and need much CPU bound tasks