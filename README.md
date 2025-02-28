# getstream.io-firebase-function
Firebase function to handle user authentication and generate Stream Chat tokens.

If you are struggling to implement video stream Chat in your project using [getstream.io](https://getstream.io) (especially for the backend side of the setup) because their documentation is not very clear about it, then you've come to the right place.

This Firebase function will help you generate Stream Chat tokens for your users. You can use this function to authenticate your users and generate Stream Chat tokens for them.

## Installation
1. Clone the repository
```bash
git clone https://github.com/getstream/getstream.io-firebase-function.git
```
2. Initialize Firebase functions
```bash
cd getstream.io-firebase-function
firebase init functions
```

Make sure to select the project you want to use for the functions and select the language as JavaScript.
Do not overwrite the existing files or you'll lose the function code.
Make sure to add you Stream Chat API key and secret in the `.env` file (for development purposes only).

If you have not already set up Firebase, you can follow the instructions [here](https://firebase.google.com/docs/functions/get-started).

## Usage

1. To run the function locally, you can use the Firebase emulator. Make sure to install the Firebase CLI and run the following command:

```bash
firebase emulators:start --only functions
```

2. Before deploying the function, make sure to add your Stream Chat API key and secret in the firebase function environment variables.

```bash
firebase functions:config:set stream.apiKey="YOUR_STREAM_API_KEY" stream.apiSecret="YOUR_STREAM_API_SECRET"
```

3. Deploy the function
```bash
firebase deploy --only functions
```
4. Test the function
```bash
curl -X POST -H "Content-Type: application/json" -d '{"userId": "test"}' https://us-central1-<project-id>.cloudfunctions.net/getStreamToken
```

## License
The MIT License (MIT)
