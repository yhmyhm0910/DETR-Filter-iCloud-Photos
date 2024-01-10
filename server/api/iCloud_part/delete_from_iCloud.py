from pyicloud import PyiCloudService
import sys
from datetime import datetime
import os
import time
import concurrent.futures
import multiprocessing
import pytz
import json

def login_iCloud(username, password):
    api = PyiCloudService(username, password)   # NO TWO-FACTOR!
    return api

def delete_photos_action(api, filter_start_date, filter_end_date, filenames):
    
    # Define a function that each thread will execute
    '''def downloader(photo):
        # IF EXECUTING DIRECTLY WITH THIS SCRIPT, ADD ../../ BEFORE public/bla_bla_bla
        # photo.filename in with open() is created when stated here
        with open(f'public/img_from_iCloud/{photo.filename}', 'wb') as opened_photo:    # wb = write binary
            print(f'photo.added_date: {photo.added_date}, photo.filename: {photo.filename}')
            original_photo = photo.download().raw.read()
            opened_photo.write(original_photo)    # copy selected photos from iCloud to local
        with open(f'public/img_from_iCloud/{os.path.splitext(photo.filename)[0]}.json', 'w') as opened_json:
            json_to_write = {
                "added_date": str(photo.added_date)
            }
            json.dump(json_to_write, opened_json, indent=4)'''


    # Define a list of image file extensions
    image_extensions = [".jpg", ".jpeg", ".png", ".heic"]
    
    # Tried enhancing this for loop but limited by doc
    for photo in api.photos.albums['All Photos']:  # sorted by added_date (desc)
        if (filter_start_date <= photo.added_date <= filter_end_date) and (os.path.splitext(photo.filename)[1].lower() in image_extensions):
            if os.path.splitext(photo.filename)[0].lower() not in filenames:
                print('photo to delete: ', photo.filename)
                photo.delete()
        if (photo.added_date < filter_start_date):
            break

def toLocalTime(date):
    formatted_date = datetime.strptime(date, '%Y-%m-%d') 
    toronto_timezone = pytz.timezone('America/Toronto')
    toronto_datetime = toronto_timezone.localize(formatted_date)
    return toronto_datetime

def deleteExistingFiles():
    directory_path = 'public/img_from_iCloud'

    file_list = os.listdir(directory_path)

    for filename in file_list:
        file_path = os.path.join(directory_path, filename)
        
        os.remove(file_path)

    print(f'All files in {directory_path} have been deleted.')

if __name__ == '__main__':

    start_time = time.time()

    username = sys.argv[3]
    password = sys.argv[4]

    print(f'logging in with username="{username}" and password="{password}"')

    api = login_iCloud(username, password)

    filter_start_date_str = sys.argv[1]
    filter_start_date_toronto = toLocalTime(filter_start_date_str)

    filter_end_date_str = sys.argv[2]
    filter_end_date_toronto = toLocalTime(filter_end_date_str)

    filenames = sys.argv[5:]

    delete_photos_action(api, filter_start_date_toronto, filter_end_date_toronto, filenames)

    for idx, s in enumerate(sys.argv):
        print(f'{idx}: {s}')
        
    end_time = time.time()
    used_time = end_time - start_time
    print('TIME USED: ', used_time)
    print('Successfully operated.')

# Result of downloading 133 imgs from 3186 imgs
# without threading: 114.79s
# with thread(unlimited): 85.00s
# with thread(actual CPU cores): 83.56s
# but with more downloading, more difference. 0 downloading = same