# SEO Final Project: Signify

SEO Tech Developer Internship, 2024 Day 1 presentation Best Overall Award

## Sign Recognition

An AI-assisted sign language interpreter that takes video input from webcam and outputs the letter/word that you are signing. A CNN model trained on [MNIST data](https://www.kaggle.com/datasets/datamunge/sign-language-mnist) with optimization using [Mediapipe's hand landmark detection library](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)

The webcam data is collected in frames and pre-processed using OpenCV and Mediapipe before being given to the trained model (stored in ONNX format: a runnable session is initialized at runtime) to predict. The predicted letter is displayed on the top left of the webcam display. Upon being predicted as the same letter for a few frames, the letter is collected and displayed on the side, beneath the reference image.

<img width="1470" alt="SignRec" src="https://github.com/user-attachments/assets/092b0c0a-4dbf-46e6-827c-46f101130ed2">

## Audio File Transcription

Upload `.wav` format files to the webpage, and behind the scenes we call on Python's [SpeechRecognition library](https://pypi.org/project/SpeechRecognition/) and Google's [Speech-to-Text API](https://cloud.google.com/speech-to-text?hl=en) in order to transcribe audio into text that would be displayed.

<img width="1470" alt="TranscribeFiles" src="https://github.com/user-attachments/assets/3cc49910-64b0-4fcd-8276-b2b5da0d971c">

### Other resources used:

- Flask
- Jingja

## Goals for Future Development

- improve model accuracy, possibly by training on hand landmark data (as supported by Mediapipe) in addition to a CNN over the pixels of the frame image
- implement motion interpretation and/or recognition of both hands: including RNN or other similiar structures to allow the model to take in a series of frames and recognize a motion of the hands as a single sign that expresses meaning and open up the massive possibilities of actually interpreting ASL as it is used in everyday scenarios
- deployment as a true webpage to allow for ease of access to everyone
